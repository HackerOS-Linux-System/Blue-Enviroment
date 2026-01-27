use std::time::{Duration, Instant};

use clap::Parser;
use smithay::backend::allocator::gbm::GbmDevice;
use smithay::backend::drm::{
    DrmDevice, DrmDeviceFd, DrmNode, NodeType,
};
use smithay::backend::egl::{EGLContext, EGLDisplay};
use smithay::backend::libinput::{LibinputInputBackend, LibinputSessionInterface};
use smithay::backend::renderer::gles::GlesRenderer;
use smithay::backend::renderer::utils::on_commit_buffer_handler;
use smithay::backend::session::libseat::LibSeatSession;
use smithay::backend::session::Session;
use smithay::backend::udev::UdevBackend;
use smithay::desktop::{Space, Window};
use smithay::input::keyboard::{FilterResult, XkbConfig};
use smithay::input::pointer::CursorImageStatus;
use smithay::input::{Seat, SeatHandler, SeatState};
use smithay::output::{Output, PhysicalProperties, Subpixel};
use smithay::reexports::calloop::{EventLoop, LoopHandle};
use smithay::reexports::drm::control::connector::State as ConnectorState;
use smithay::reexports::drm::control::Device;
use smithay::reexports::input::Libinput;
use smithay::reexports::wayland_server::backend::{ClientData, ClientId, DisconnectReason};
use smithay::reexports::wayland_server::protocol::{wl_buffer, wl_seat, wl_surface};
use smithay::reexports::wayland_server::{Display, DisplayHandle, ListeningSocket, Resource};
use smithay::reexports::rustix::fs::OFlags;
use smithay::utils::Transform;
use smithay::wayland::buffer::BufferHandler;
use smithay::wayland::compositor::{
    CompositorClientState, CompositorHandler, CompositorState,
};
use smithay::wayland::shell::xdg::{
    PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
};
use smithay::wayland::shm::{ShmHandler, ShmState};
use smithay::{delegate_compositor, delegate_seat, delegate_shm, delegate_xdg_shell};
use smithay::backend::input::{Event, KeyboardKeyEvent}; // Added KeyboardKeyEvent trait
use tracing::info;

// --- Argumenty CLI ---
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Komenda do uruchomienia po starcie kompozytora (np. "alacritty", "weston-terminal")
    #[arg(required = true)]
    command: String,

    /// Argumenty dla komendy (opcjonalne)
    #[arg(last = true)]
    command_args: Vec<String>,
}

// --- Struktura Stanu Aplikacji ---

pub struct AppState {
    pub compositor_state: CompositorState,
    pub xdg_shell_state: XdgShellState,
    pub shm_state: ShmState,
    pub seat_state: SeatState<AppState>,
    pub seat: Seat<AppState>,
    
    // Smithay Space zarządza pozycjonowaniem okien i wyjść (monitorów)
    pub space: Space<Window>,
    
    pub loop_handle: LoopHandle<'static, AppState>,
    pub start_time: Instant,
    pub running: bool,
}

impl AppState {
    pub fn new(dh: &DisplayHandle, loop_handle: LoopHandle<'static, AppState>) -> Self {
        let mut seat_state = SeatState::new();
        let mut seat = seat_state.new_wl_seat(dh, "seat0");

        // Konfiguracja klawiatury
        let _ = seat.add_keyboard(XkbConfig::default(), 200, 25);
        // Konfiguracja wskaźnika (myszy)
        let _ = seat.add_pointer();

        Self {
            compositor_state: CompositorState::new::<Self>(dh),
            xdg_shell_state: XdgShellState::new::<Self>(dh),
            shm_state: ShmState::new::<Self>(dh, vec![]),
            seat_state,
            seat,
            space: Space::default(),
            loop_handle,
            start_time: Instant::now(),
            running: true,
        }
    }
}

// --- Handlery Wayland ---

impl CompositorHandler for AppState {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }

    fn client_compositor_state<'a>(&self, client: &'a smithay::reexports::wayland_server::Client) -> &'a CompositorClientState {
        &client.get_data::<ClientState>().unwrap().compositor_state
    }

    fn commit(&mut self, surface: &wl_surface::WlSurface) {
        on_commit_buffer_handler::<Self>(surface);
        // Space automatically tracks surface commits via internal handlers if elements are mapped
    }
}

impl XdgShellHandler for AppState {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState {
        &mut self.xdg_shell_state
    }

    fn new_toplevel(&mut self, surface: ToplevelSurface) {
        let window = Window::new_wayland_window(surface);
        // Dodaj okno do przestrzeni w pozycji (0,0) lub innej logice kaskadowej
        self.space.map_element(window, (0, 0), true);
    }

    fn new_popup(&mut self, _surface: PopupSurface, _positioner: PositionerState) {
        // TODO: Obsługa popupów (menu kontekstowe)
    }
    
    fn grab(&mut self, _surface: PopupSurface, _seat: wl_seat::WlSeat, _serial: smithay::utils::Serial) {}
    fn reposition_request(&mut self, _surface: PopupSurface, _positioner: PositionerState, _token: u32) {}
}

impl SeatHandler for AppState {
    type KeyboardFocus = wl_surface::WlSurface;
    type PointerFocus = wl_surface::WlSurface;
    type TouchFocus = wl_surface::WlSurface;

    fn seat_state(&mut self) -> &mut SeatState<AppState> {
        &mut self.seat_state
    }

    fn cursor_image(&mut self, _seat: &Seat<Self>, _image: CursorImageStatus) {}
    
    fn focus_changed(&mut self, _seat: &Seat<Self>, focused: Option<&Self::KeyboardFocus>) {
        // Obsługa fokusu klawiatury
        if let Some(focused_surface) = focused {
            let client = focused_surface.client();
            if let Some(_client) = client {
                 // Tutaj można dodać logikę np. podświetlania aktywnego okna
            }
        }
    }
}

impl ShmHandler for AppState {
    fn shm_state(&self) -> &ShmState {
        &self.shm_state
    }
}

impl BufferHandler for AppState {
    fn buffer_destroyed(&mut self, _buffer: &wl_buffer::WlBuffer) {}
}

// --- Struktura Klienta ---
pub struct ClientState {
    pub compositor_state: CompositorClientState,
}
impl ClientData for ClientState {
    fn initialized(&self, _client_id: ClientId) {}
    fn disconnected(&self, _client_id: ClientId, _reason: DisconnectReason) {}
}

delegate_compositor!(AppState);
delegate_xdg_shell!(AppState);
delegate_shm!(AppState);
delegate_seat!(AppState);

fn main() {
    let args = Args::parse();

    // 1. Konfiguracja Logowania (Plik + Stdout)
    let file_appender = tracing_appender::rolling::daily("/tmp", "blue-compositor.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();

    info!("Inicjalizacja Blue Environment Compositor...");

    // 2. Event Loop
    let mut event_loop: EventLoop<AppState> = EventLoop::try_new().unwrap();
    let loop_handle = event_loop.handle();

    // 3. Display
    let mut display: Display<AppState> = Display::new().unwrap();
    let display_handle = display.handle();

    // 4. Stan Aplikacji
    let mut state = AppState::new(&display_handle, loop_handle.clone());

    // 5. Inicjalizacja Sesji (LibSeat) - Kluczowe dla działania na TTY
    let (mut session, notifier) = LibSeatSession::new().expect("Nie udało się zainicjować sesji (czy seatd działa?)");
    
    loop_handle.insert_source(notifier, move |_, _, _| {
        // Obsługa sygnałów sesji (np. przełączenie TTY, pauza, wznowienie)
        // W pełnej implementacji należy reagować na pauzę (zatrzymać rendering) i wznowienie.
    }).unwrap();

    // 6. Backend Udev (Wykrywanie GPU)
    let udev_backend = UdevBackend::new(&session.seat()).expect("Nie udało się zainicjować backendu Udev");
    
    // Znajdź główny GPU (primary)
    let mut primary_gpu = None;
    for (dev_id, path) in udev_backend.device_list() {
         if let Ok(drm_node) = DrmNode::from_dev_id(dev_id) {
             // Interesują nas tylko karty renderujące/główne
             if drm_node.has_render() || drm_node.ty() == NodeType::Primary {
                 primary_gpu = Some((dev_id, path));
                 break; 
             }
         }
    }

    let (_gpu_id, gpu_path) = primary_gpu.expect("Nie znaleziono odpowiedniego GPU!");
    info!("Używam GPU: {:?}", gpu_path);

    // 7. Otwarcie urządzenia DRM
    let fd = session.open(
        &gpu_path, 
        OFlags::RDWR | OFlags::CLOEXEC | OFlags::NOCTTY | OFlags::NONBLOCK
    ).expect("Nie udało się otworzyć urządzenia DRM");

    let drm_device_fd = DrmDeviceFd::new(fd.into());
    let (drm_device, drm_notifier) = DrmDevice::new(drm_device_fd.clone(), true).expect("Błąd inicjalizacji DRM Device");

    loop_handle.insert_source(drm_notifier, move |_, _, _| {
        // Obsługa zdarzeń DRM (np. vblank)
    }).unwrap();

    // 8. Inicjalizacja Renderera (GBM + EGL + GLES)
    let gbm_device = GbmDevice::new(drm_device_fd.clone()).expect("Błąd GBM");
    // SAFETY: EGLDisplay::new jest unsafe i wymaga bloku unsafe
    let egl_display = unsafe { EGLDisplay::new(gbm_device.clone()).expect("Błąd EGL Display") };
    let context = EGLContext::new(&egl_display).expect("Błąd EGL Context");
    let _renderer = unsafe { GlesRenderer::new(context) }.expect("Błąd GlesRenderer");

    // 9. Inicjalizacja Libinput (Klawiatura/Mysz)
    let mut libinput_context = Libinput::new_with_udev::<LibinputSessionInterface<LibSeatSession>>(
        LibinputSessionInterface::from(session.clone())
    );
    libinput_context.udev_assign_seat(&session.seat()).unwrap();

    // Dodanie Libinput do pętli zdarzeń
    loop_handle.insert_source(LibinputInputBackend::new(libinput_context.clone()), move |event, _, state| {
        use smithay::backend::input::{InputEvent};
        
        match event {
            InputEvent::DeviceAdded { .. } => {
                info!("Podłączono urządzenie wejściowe");
            }
            InputEvent::DeviceRemoved { .. } => {
                info!("Odłączono urządzenie wejściowe");
            }
            InputEvent::Keyboard { event } => {
                if let Some(keyboard) = state.seat.get_keyboard() {
                     let serial = 0.into(); 
                     let time = event.time_msec();
                     keyboard.input::<AppState, _>(
                         state, event.key_code(), event.state(), serial, time, 
                         |_, _, _| FilterResult::Forward
                     );
                }
            }
            InputEvent::PointerMotionAbsolute { event } => {
                // Przykład obsługi ruchu (wymaga przeliczenia na współrzędne ekranu)
                if let Some(_pointer) = state.seat.get_pointer() {
                    let _serial = 0;
                    let _time = event.time_msec();
                    // Tutaj normalnie przeliczamy pozycję
                    // pointer.motion(...)
                }
            }
            _ => {
               // Inne zdarzenia
            }
        }
    }).unwrap();

    // 10. Konfiguracja Monitorów (Connectors)
    let res_handles = drm_device.resource_handles().unwrap();
    for connector_handle in res_handles.connectors() {
        let connector = drm_device.get_connector(*connector_handle, true).unwrap();
        if connector.state() == ConnectorState::Connected {
            info!("Znaleziono monitor: {:?}", connector.interface());
            
            if connector.modes().is_empty() { continue; }
            let drm_mode = connector.modes()[0]; 
            
            // Konwersja trybu DRM na tryb Smithay Output
            // Używamy getterów size() i vrefresh(), ponieważ pola są prywatne.
            let mode = smithay::output::Mode {
                size: (drm_mode.size().0 as i32, drm_mode.size().1 as i32).into(),
                // vrefresh zwraca Hz, Smithay oczekuje mHz (miliherce)
                refresh: (drm_mode.vrefresh() as i32) * 1000,
            };

            let output = Output::new(
                "DrmOutput".into(), 
                PhysicalProperties {
                    size: (0,0).into(),
                    subpixel: Subpixel::Unknown,
                    make: "Generic".into(),
                    model: "Monitor".into(),
                    serial_number: "Unknown".into(),
                }
            );
            
            output.change_current_state(
                Some(mode),
                Some(Transform::Normal),
                Some(smithay::output::Scale::Integer(1)),
                None
            );
            output.set_preferred(mode);
            state.space.map_output(&output, (0,0));
        }
    }

    // 11. Socket Wayland
    let listening_socket = ListeningSocket::bind_auto("wayland", 1..32).unwrap();
    let socket_name = listening_socket.socket_name().unwrap().to_string_lossy().into_owned();
    info!("Gniazdo Wayland aktywne: {:?}", socket_name);

    // 12. Uruchomienie aplikacji użytkownika
    info!("Uruchamiam: {} {}", args.command, args.command_args.join(" "));
    std::process::Command::new(args.command)
        .args(args.command_args)
        .env("WAYLAND_DISPLAY", &socket_name)
        .spawn()
        .expect("Nie udało się uruchomić wskazanej aplikacji");

    // 13. Główna Pętla
    loop {
        // Dispatch Wayland Clients
        display.flush_clients().unwrap();
        state.space.refresh();

        let _ = event_loop.dispatch(Some(Duration::from_millis(16)), &mut state);
        
        if !state.running {
            break;
        }
    }
}
