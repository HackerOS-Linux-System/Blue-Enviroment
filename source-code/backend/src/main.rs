use smithay::backend::renderer::gles::GlesRenderer;
use smithay::backend::renderer::utils::on_commit_buffer_handler;
use smithay::backend::renderer::{Frame, Renderer};
use smithay::backend::winit::{self, WinitEvent};
use smithay::reexports::winit::platform::pump_events::PumpStatus;
use smithay::delegate_compositor;
use smithay::delegate_seat;
use smithay::delegate_shm;
use smithay::delegate_xdg_shell;
use smithay::input::pointer::{CursorImageStatus};
use smithay::input::{Seat, SeatHandler, SeatState};
use smithay::reexports::wayland_server::backend::{ClientData, ClientId, DisconnectReason};
use smithay::reexports::wayland_server::protocol::{wl_buffer, wl_seat, wl_surface};
use smithay::reexports::wayland_server::{Display, DisplayHandle, ListeningSocket};
use smithay::utils::{Rectangle, Transform, Size};
use smithay::utils::Serial;
use smithay::wayland::buffer::BufferHandler;
use smithay::wayland::compositor::{
    with_states, CompositorClientState, CompositorHandler, CompositorState,
};
use smithay::wayland::shell::xdg::{
    PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
};
use smithay::reexports::wayland_protocols::xdg::shell::server::xdg_toplevel::State as XdgState;
use smithay::wayland::shm::{ShmHandler, ShmState};
use std::sync::Arc;

pub struct AppState {
    pub compositor_state: CompositorState,
    pub xdg_shell_state: XdgShellState,
    pub shm_state: ShmState,
    pub seat_state: SeatState<AppState>,
    pub seat: Seat<AppState>,
    pub windows: Vec<ToplevelSurface>,
}

impl AppState {
    pub fn new(dh: &DisplayHandle) -> Self {
        let mut seat_state = SeatState::new();
        let _seat = seat_state.new_wl_seat(dh, "winit-seat");

        Self {
            compositor_state: CompositorState::new::<Self>(dh),
            xdg_shell_state: XdgShellState::new::<Self>(dh),
            shm_state: ShmState::new::<Self>(dh, vec![]),
            seat_state,
            seat: _seat,
            windows: Vec::new(),
        }
    }
}

// --- Handlery ---

impl CompositorHandler for AppState {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }

    fn client_compositor_state<'a>(&self, client: &'a smithay::reexports::wayland_server::Client) -> &'a CompositorClientState {
        &client.get_data::<ClientState>().unwrap().compositor_state
    }

    fn commit(&mut self, surface: &wl_surface::WlSurface) {
        on_commit_buffer_handler::<Self>(surface);
    }
}

impl XdgShellHandler for AppState {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState {
        &mut self.xdg_shell_state
    }

    fn new_toplevel(&mut self, surface: ToplevelSurface) {
        surface.with_pending_state(|state| {
            state.states.set(XdgState::Activated);
        });
        surface.send_configure();
        self.windows.push(surface);
    }

    fn new_popup(&mut self, _surface: PopupSurface, _positioner: PositionerState) {}
    fn grab(&mut self, _surface: PopupSurface, _seat: wl_seat::WlSeat, _serial: Serial) {}
    
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
    fn focus_changed(&mut self, _seat: &Seat<Self>, _focused: Option<&Self::KeyboardFocus>) {}
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

// --- Makra Delegate ---
delegate_compositor!(AppState);
delegate_xdg_shell!(AppState);
delegate_shm!(AppState);
delegate_seat!(AppState);

fn main() {
    if let Err(_) = std::env::var("RUST_LOG") {
        std::env::set_var("RUST_LOG", "info,smithay=info");
    }
    env_logger::init();

    log::info!("Starting Blue Environment Compositor...");

    // 1. Inicjalizacja Display (Wayland Server)
    let mut display: Display<AppState> = Display::new().unwrap();
    let dh = display.handle();

    // 2. Inicjalizacja Winit (Backend)
    // Jawne podanie typu renderera pomaga w inferencji.
    let (mut backend, mut winit) = winit::init::<GlesRenderer>().unwrap();

    let mut state = AppState::new(&dh);

    // Socket
    let listening_socket = ListeningSocket::bind_auto("wayland", 1..32).unwrap();
    let socket_name = listening_socket.socket_name().unwrap().to_string_lossy().into_owned();
    log::info!("Listening on wayland socket: {:?}", socket_name);

    loop {
        // Accept connection
        if let Ok(Some(stream)) = listening_socket.accept() {
            log::info!("New client connected");
            if let Err(e) = display.handle().insert_client(stream, Arc::new(ClientState {
                 compositor_state: CompositorClientState::default(),
            })) {
                 log::error!("Failed to insert client: {:?}", e);
            }
        }

        // Dispatch Wayland
        if let Err(e) = display.dispatch_clients(&mut state) {
            log::error!("Dispatch error: {:?}", e);
        }

        // Dispatch Winit
        let res = winit.dispatch_new_events(|event| {
            match event {
                WinitEvent::Resized { size, .. } => {
                    log::debug!("Resized to {:?}", size);
                }
                WinitEvent::Input(_event) => {
                    // Placeholder input handling
                }
                _ => {},
            };
        });

        // Obsługa PumpStatus
        match res {
            PumpStatus::Exit(_) => break,
            PumpStatus::Continue => {},
        }

        // Renderowanie
        // Blok { ... } jest konieczny, aby zwolnić pożyczkę (borrow) 'backend' przed wywołaniem 'submit'.
        {
            // Pobieramy renderer i target z backend.bind().
            // bind() zwraca krotkę (&mut Renderer, Target).
            let (renderer, mut target) = match backend.bind() {
                Ok(res) => res,
                Err(e) => {
                    log::error!("Failed to bind backend: {:?}", e);
                    continue;
                }
            };
            
            // Renderujemy używając pobranego renderera.
            let mut frame = renderer.render(
                &mut target,
                Size::from((800, 600)), 
                Transform::Normal,
            ).unwrap();

            frame.clear(
                [0.1, 0.1, 0.4, 1.0].into(), 
                &[Rectangle::new((0, 0).into(), (800, 600).into())]
            ).unwrap();

            for window in &state.windows {
                let surface = window.wl_surface();
                with_states(surface, |_states| {
                    // Render logic placeholder
                });
            }

            frame.finish().unwrap();
        }

        if let Err(e) = backend.submit(None) {
             log::error!("Failed to submit buffer: {:?}", e);
        }
    }
}
