use smithay::{
    backend::{
        renderer::{
            gles2::Gles2Renderer,
            utils::on_commit_buffer_handler,
        },
        winit::{self, WinitEvent},
    },
    delegate_compositor, delegate_seat, delegate_shm, delegate_xdg_shell,
    input::{
        pointer::{CursorImageStatus, PointerHandler},
        Seat, SeatHandler, SeatState,
    },
    reexports::{
        wayland_server::{
            backend::{ClientData, ClientId, DisconnectReason},
            protocol::{wl_buffer, wl_seat, wl_surface},
            Display, DisplayHandle, Resource,
        },
    },
    utils::{Logical, Point, Rectangle, Serial, Size, Transform},
    wayland::{
        buffer::BufferHandler,
        compositor::{
            with_states, CompositorClientState, CompositorHandler, CompositorState, TraversalAction,
        },
        shell::xdg::{
            PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
        },
        shm::{ShmHandler, ShmState},
    },
};
use std::sync::Arc;

struct AppState {
    compositor_state: CompositorState,
    xdg_shell_state: XdgShellState,
    shm_state: ShmState,
    seat_state: SeatState<AppState>,
    seat: Seat<AppState>,

    // Track windows
    windows: Vec<ToplevelSurface>,
}

impl AppState {
    fn new(dh: &DisplayHandle) -> Self {
        let mut seat_state = SeatState::new();
        let seat = seat_state.new_wl_seat(dh, "winit-seat");

        Self {
            compositor_state: CompositorState::new::<Self>(dh),
            xdg_shell_state: XdgShellState::new::<Self>(dh),
            shm_state: ShmState::new::<Self>(dh, vec![]),
            seat_state,
            seat,
            windows: Vec::new(),
        }
    }
}

// --- Handler Implementations ---

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
            state.states.set(smithay::wayland::shell::xdg::ToplevelState::Activated);
        });
        surface.send_configure();
        self.windows.push(surface);
    }
    fn new_popup(&mut self, _surface: PopupSurface, _positioner: PositionerState) {}
    fn grab(&mut self, _surface: PopupSurface, _seat: wl_seat::WlSeat, _serial: Serial) {}
}

impl SeatHandler for AppState {
    type KeyboardFocus = wl_surface::WlSurface;
    type PointerFocus = wl_surface::WlSurface;

    fn seat_state(&mut self) -> &mut SeatState<AppState> {
        &mut self.seat_state
    }
    fn cursor_image(&mut self, _seat: &Seat<Self>, _image: CursorImageStatus) {}
}

impl PointerHandler for AppState {
    fn pointer_frame(&mut self, _seat: &Seat<Self>, _event: &smithay::input::pointer::PointerFrameEvent) {}
}

impl ShmHandler for AppState {
    fn shm_state(&self) -> &ShmState {
        &self.shm_state
    }
}

impl BufferHandler for AppState {
    fn buffer_destroyed(&mut self, _buffer: &wl_buffer::WlBuffer) {}
}

// --- Glue Code ---

struct ClientState {
    compositor_state: CompositorClientState,
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
    if let Err(_) = std::env::var("RUST_LOG") {
        std::env::set_var("RUST_LOG", "info");
    }
    env_logger::init();

    log::info!("Starting Blue Environment Compositor (Smithay Powered)...");

    let mut display: Display<AppState> = Display::new().unwrap();
    let dh = display.handle();

    let (mut backend, mut winit) = winit::init::<Gles2Renderer>().unwrap();

    let mut state = AppState::new(&dh);

    // Listen on Wayland socket
    let socket = display.add_socket_auto().unwrap();
    log::info!("Listening on wayland socket: {:?}", socket.into_string());

    loop {
        // 1. Dispatch Wayland clients
        if let Err(e) = display.dispatch_clients(&mut state) {
            log::error!("Dispatch error: {:?}", e);
        }

        // 2. Dispatch Winit events (Input)
        winit.dispatch_new_events(|event| {
            match event {
                WinitEvent::Resized { size, .. } => {
                    // Handle output resize
                }
                WinitEvent::Input(event) => {
                    // In a full implementation, pass input to Seat
                }
                _ => {},
            };
        }).unwrap();

        // 3. Render Loop
        backend.bind().unwrap();

        let renderer = backend.renderer();

        // Clear background to Blue-ish
        use smithay::backend::renderer::Frame;
        let mut frame = renderer.render(
            (800, 600).into(),
                                        Transform::Normal,
        ).unwrap();

        frame.clear(
            [0.1, 0.1, 0.2, 1.0], // Dark Blue
            &[Rectangle::from_loc_and_size((0, 0), (800, 600))]
        ).unwrap();

        // Draw windows
        for window in &state.windows {
            let surface = window.wl_surface();
            with_states(surface, |states| {
                // Render logic would go here using `smithay::backend::renderer::element::surface`
            });
        }

        frame.finish().unwrap();

        backend.submit(None).unwrap();
    }
}
