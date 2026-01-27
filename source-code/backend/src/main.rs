use std::collections::HashMap;
use std::os::unix::io::BorrowedFd;
use std::time::{Duration, Instant};

use clap::Parser;
use smithay::backend::allocator::gbm::{GbmBufferFlags, GbmDevice};
use smithay::backend::drm::{DrmDevice, DrmDeviceFd, DrmNode, NodeType};
use smithay::backend::egl::{EGLContext, EGLDisplay};
use smithay::backend::libinput::{LibinputInputBackend, LibinputSessionInterface};
use smithay::backend::renderer::gles::GlesRenderer;
use smithay::backend::renderer::utils::on_commit_buffer_handler;
use smithay::backend::renderer::Bind;
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
use smithay::reexports::drm::control::{crtc, PageFlipFlags};
use smithay::reexports::drm::control::Device as ControlDevice;
use smithay::reexports::gbm::Surface as GbmSurface;
use smithay::reexports::input::Libinput;
use smithay::reexports::rustix::fs::OFlags;
use smithay::reexports::wayland_server::backend::{ClientData, ClientId, DisconnectReason};
use smithay::reexports::wayland_server::protocol::{wl_buffer, wl_seat, wl_surface};
use smithay::reexports::wayland_server::{Display, DisplayHandle, ListeningSocket};
use smithay::utils::{Transform, Serial};
use smithay::wayland::buffer::BufferHandler;
use smithay::wayland::compositor::{CompositorClientState, CompositorHandler, CompositorState};
use smithay::wayland::shell::xdg::{
    PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
};
use smithay::wayland::shm::{ShmHandler, ShmState};
use smithay::{delegate_compositor, delegate_seat, delegate_shm, delegate_xdg_shell};
use smithay::backend::renderer::damage::OutputDamageTracker;
use smithay::backend::input::{Event, KeyboardKeyEvent};
use smithay::backend::allocator::dmabuf::{Dmabuf, DmabufFlags};
use tracing::{error, info, warn};

// --- Argumenty CLI ---
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(required = true)]
    command: String,
    #[arg(last = true)]
    command_args: Vec<String>,
}

// --- Struktura pomocnicza dla każdego monitora ---
struct SurfaceData {
    gbm_surface: GbmSurface<BorrowedFd<'static>>,
    damage_tracker: OutputDamageTracker,
    crtc: crtc::Handle,
    frame_scheduled: bool,
    mode: smithay::reexports::drm::control::Mode,
    connectors: Vec<smithay::reexports::drm::control::connector::Handle>,
    configured: bool,
}

// --- Struktura Stanu Aplikacji ---
pub struct AppState {
    pub compositor_state: CompositorState,
    pub xdg_shell_state: XdgShellState,
    pub shm_state: ShmState,
    pub seat_state: SeatState<AppState>,
    pub seat: Seat<AppState>,

    pub space: Space<Window>,
    pub loop_handle: LoopHandle<'static, AppState>,
    pub start_time: Instant,
    pub running: bool,

    pub renderer: GlesRenderer,
    pub drm_device: DrmDevice,
    pub drm_device_fd: DrmDeviceFd, // Needed for direct control calls (page_flip, etc.)
    pub gbm_device: GbmDevice<DrmDeviceFd>,
    pub surfaces: HashMap<Output, SurfaceData>,
}

impl AppState {
    pub fn new(
        dh: &DisplayHandle,
        loop_handle: LoopHandle<'static, AppState>,
        renderer: GlesRenderer,
        drm_device: DrmDevice,
        drm_device_fd: DrmDeviceFd,
        gbm_device: GbmDevice<DrmDeviceFd>,
    ) -> Self {
        let mut seat_state = SeatState::new();
        let mut seat = seat_state.new_wl_seat(dh, "seat0");

        let _ = seat.add_keyboard(XkbConfig::default(), 200, 25);
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
            renderer,
            drm_device,
            drm_device_fd,
            gbm_device,
            surfaces: HashMap::new(),
        }
    }
}

// --- Handlery Wayland ---

impl CompositorHandler for AppState {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }

    fn client_compositor_state<'a>(
        &self,
        client: &'a smithay::reexports::wayland_server::Client,
    ) -> &'a CompositorClientState {
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
        let window = Window::new_wayland_window(surface);
        self.space.map_element(window, (0, 0), true);
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

// --- GŁÓWNA FUNKCJA RENDERUJĄCA ---
fn render_output(state: &mut AppState, output: &Output) {
    let surface_data = match state.surfaces.get_mut(output) {
        Some(data) => data,
        None => return,
    };

    if surface_data.frame_scheduled {
        return;
    }

    let crtc = surface_data.crtc;

    let gbm_buffer = match unsafe { surface_data.gbm_surface.lock_front_buffer() } {
        Ok(v) => v,
        Err(err) => {
            error!("Nie udało się pobrać bufora GBM: {}", err);
            return;
        }
    };

    // Manual conversion to Dmabuf
    let mut dmabuf = {
        let fd = gbm_buffer.fd().unwrap();
        // Use rustix dup to safely clone the borrowed FD into an OwnedFd
        let owned_fd = match smithay::reexports::rustix::io::dup(fd) {
            Ok(f) => f,
            Err(e) => {
                error!("Błąd duplikowania FD: {}", e);
                return;
            }
        };

        // Fixed: modifier() and stride() return values directly in recent gbm-rs
        let modifier = gbm_buffer.modifier(); 
        let stride = gbm_buffer.stride();
        
        let mut builder = Dmabuf::builder(
            (gbm_buffer.width() as i32, gbm_buffer.height() as i32),
            smithay::backend::allocator::Fourcc::try_from(gbm_buffer.format() as u32).unwrap_or(smithay::backend::allocator::Fourcc::Argb8888),
            modifier,
            DmabufFlags::empty()
        );

        // Fixed: add_plane takes (fd, plane_index, offset, stride)
        builder.add_plane(owned_fd, 0, 0, stride);
        
        // Fixed: build() returns Option<Dmabuf>
        match builder.build() {
            Some(d) => d,
            None => {
                error!("Błąd budowania Dmabuf");
                return;
            }
        }
    };

    // Bind buffer to renderer to get a target
    // Fixed: bind takes &mut Dmabuf
    let mut target = match state.renderer.bind(&mut dmabuf) {
        Ok(t) => t,
        Err(err) => {
            error!("Błąd bindowania renderera: {}", err);
            return;
        }
    };

    // Collect elements to draw using Space's helper
    // Fixed: render_elements_for_output requires (renderer, output, scale)
    let elements = match state.space.render_elements_for_output(
        &mut state.renderer,
        output,
        1.0 // Scale (assuming 1.0 for now, could be derived from output)
    ) {
        Ok(e) => e,
        Err(err) => {
            error!("Błąd pobierania elementów do renderowania: {}", err);
            return;
        }
    };

    let render_res = surface_data
        .damage_tracker
        .render_output(
            &mut state.renderer,
            &mut target,
            0,
            &elements,
            [0.1, 0.1, 0.1, 1.0], // Clear color (Dark Gray)
        );

    match render_res {
        Ok(_) => {
            // Add framebuffer using the raw DRM device FD
            let fb = match state.drm_device_fd.add_framebuffer(
                &gbm_buffer,
                24,
                32,
            ) {
                Ok(fb) => fb,
                Err(err) => {
                    error!("Błąd tworzenia Framebuffera DRM: {}", err);
                    return;
                }
            };

            // Initial modeset
            if !surface_data.configured {
                if let Err(err) = state.drm_device_fd.set_crtc(
                    crtc,
                    Some(fb),
                    (0, 0),
                    &surface_data.connectors,
                    Some(surface_data.mode),
                ) {
                    error!("Błąd set_crtc: {}", err);
                    return;
                }
                surface_data.configured = true;
            }

            // Schedule Page Flip
            if let Err(err) = state.drm_device_fd.page_flip(
                crtc,
                fb,
                PageFlipFlags::EVENT,
                None,
            ) {
                error!("Błąd page_flip: {}", err);
            } else {
                surface_data.frame_scheduled = true;
            }
        }
        Err(err) => {
            error!("Błąd renderowania sceny: {}", err);
        }
    }
}

fn main() {
    let args = Args::parse();

    let file_appender = tracing_appender::rolling::daily("/tmp", "blue-compositor.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();

    info!("Inicjalizacja Blue Environment Compositor...");

    let mut event_loop: EventLoop<AppState> = EventLoop::try_new().unwrap();
    let loop_handle = event_loop.handle();

    let mut display: Display<AppState> = Display::new().unwrap();
    let display_handle = display.handle();

    let (mut session, notifier) = LibSeatSession::new().expect("Nie udało się zainicjować sesji");
    loop_handle.insert_source(notifier, move |_, _, _| {}).unwrap();

    let udev_backend = UdevBackend::new(&session.seat()).expect("Błąd Udev");

    let mut primary_gpu = None;
    for (dev_id, path) in udev_backend.device_list() {
        if let Ok(drm_node) = DrmNode::from_dev_id(dev_id) {
            if drm_node.has_render() || drm_node.ty() == NodeType::Primary {
                primary_gpu = Some((dev_id, path));
                break;
            }
        }
    }
    let (_gpu_id, gpu_path) = primary_gpu.expect("Nie znaleziono GPU!");
    info!("Używam GPU: {:?}", gpu_path);

    let fd = session.open(
        &gpu_path,
        OFlags::RDWR | OFlags::CLOEXEC | OFlags::NOCTTY | OFlags::NONBLOCK,
    ).expect("Błąd open DRM");

    let drm_device_fd = DrmDeviceFd::new(fd.into());
    let (drm_device, drm_notifier) = DrmDevice::new(drm_device_fd.clone(), true).expect("Błąd DRM Device");

    let gbm_device = GbmDevice::new(drm_device_fd.clone()).expect("Błąd GBM Device");
    let egl_display = unsafe { EGLDisplay::new(gbm_device.clone()).expect("Błąd EGL Display") };
    let context = EGLContext::new(&egl_display).expect("Błąd EGL Context");
    let renderer = unsafe { GlesRenderer::new(context) }.expect("Błąd GlesRenderer");

    // Pass drm_device_fd explicitly to AppState for raw control operations
    let mut state = AppState::new(
        &display_handle,
        loop_handle.clone(),
        renderer,
        drm_device,
        drm_device_fd,
        gbm_device,
    );

    loop_handle.insert_source(drm_notifier, move |event, _, state| {
        match event {
            smithay::backend::drm::DrmEvent::VBlank(crtc) => {
                for (_, surface_data) in state.surfaces.iter_mut() {
                    if surface_data.crtc == crtc {
                        surface_data.frame_scheduled = false;
                    }
                }
            }
            smithay::backend::drm::DrmEvent::Error(err) => {
                error!("Błąd DRM event: {:?}", err);
            }
        }
    }).unwrap();

    let mut libinput_context = Libinput::new_with_udev::<LibinputSessionInterface<LibSeatSession>>(
        LibinputSessionInterface::from(session.clone()),
    );
    libinput_context.udev_assign_seat(&session.seat()).unwrap();
    loop_handle.insert_source(LibinputInputBackend::new(libinput_context), move |event, _, state| {
        use smithay::backend::input::InputEvent;
        match event {
            InputEvent::Keyboard { event } => {
                if let Some(keyboard) = state.seat.get_keyboard() {
                    keyboard.input::<AppState, _>(
                        state, event.key_code(), event.state(), 0.into(), event.time_msec(),
                        |_, _, _| FilterResult::Forward
                    );
                }
            }
            InputEvent::PointerMotionAbsolute { event: _ } => {
               // Tutaj powinna być obsługa myszy
            }
            _ => {}
        }
    }).unwrap();

    let res_handles = state.drm_device.resource_handles().unwrap();
    let mut crtcs = res_handles.crtcs().to_vec();

    for connector_handle in res_handles.connectors() {
        let connector = state.drm_device.get_connector(*connector_handle, true).unwrap();
        
        if connector.state() == ConnectorState::Connected {
            if connector.modes().is_empty() { continue; }
            if crtcs.is_empty() { warn!("Brak wolnych CRTC dla monitora!"); break; }

            let drm_mode = connector.modes()[0];
            let crtc = crtcs.remove(0);
            
            info!("Konfiguracja monitora: {:?} na CRTC {:?}", connector.interface(), crtc);

            let mode = smithay::output::Mode {
                size: (drm_mode.size().0 as i32, drm_mode.size().1 as i32).into(),
                refresh: (drm_mode.vrefresh() as i32) * 1000,
            };

            let output = Output::new(
                "DrmOutput".into(),
                PhysicalProperties {
                    size: (0, 0).into(),
                    subpixel: Subpixel::Unknown,
                    make: "Generic".into(),
                    model: "Monitor".into(),
                    serial_number: "Unknown".into(),
                },
            );

            output.change_current_state(Some(mode), Some(Transform::Normal), Some(smithay::output::Scale::Integer(1)), None);
            output.set_preferred(mode);
            state.space.map_output(&output, (0, 0));

            // Fixed: cast to u32 for create_surface
            let gbm_surface = state.gbm_device.create_surface(
                drm_mode.size().0 as u32,
                drm_mode.size().1 as u32,
                smithay::reexports::gbm::Format::Xrgb8888,
                GbmBufferFlags::RENDERING | GbmBufferFlags::SCANOUT,
            ).expect("Failed to create GBM surface");

            let damage_tracker = OutputDamageTracker::from_output(&output);

            state.surfaces.insert(output, SurfaceData {
                gbm_surface,
                damage_tracker,
                crtc,
                frame_scheduled: false,
                mode: drm_mode,
                connectors: vec![*connector_handle],
                configured: false,
            });
        }
    }

    let listening_socket = ListeningSocket::bind_auto("wayland", 1..32).unwrap();
    let socket_name = listening_socket.socket_name().unwrap().to_string_lossy().into_owned();
    
    std::process::Command::new(args.command)
        .args(args.command_args)
        .env("WAYLAND_DISPLAY", &socket_name)
        .spawn()
        .expect("Failed to start command");

    loop {
        display.flush_clients().unwrap();
        
        let _ = event_loop.dispatch(Some(Duration::from_millis(16)), &mut state);

        let outputs: Vec<Output> = state.space.outputs().cloned().collect();
        for output in outputs {
            render_output(&mut state, &output);
        }

        if !state.running {
            break;
        }
    }
}
