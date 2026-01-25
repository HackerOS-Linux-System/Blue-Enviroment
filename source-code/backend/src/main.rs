use smithay::{
    backend::{
        renderer::{gles::GlesRenderer, utils::on_commit_buffer_handler},
        winit,
    },
    delegate_compositor, delegate_shm, delegate_xdg_shell, delegate_seat,
    wayland::{
        buffer::BufferHandler,
        compositor::{CompositorState, CompositorHandler, CompositorClientState},
        shell::xdg::{XdgShellState, XdgShellHandler, ToplevelSurface, PopupSurface, PositionerState},
        shm::{ShmState, ShmHandler},
    },
    input::{Seat, SeatState, SeatHandler, pointer::CursorImageStatus},
    reexports::wayland_server::{
        Display, DisplayHandle, Client,
        protocol::{wl_surface::WlSurface, wl_buffer::WlBuffer, wl_seat::WlSeat},
        backend::{ClientData, ClientId, DisconnectReason},
    },
    utils::Serial,
};
use slog::Drain;

struct ClientState {
    compositor_state: CompositorClientState,
}

impl ClientData for ClientState {
    fn initialized(&self, _client_id: ClientId) {}
    fn disconnected(&self, _client_id: ClientId, _reason: DisconnectReason) {}
}

struct State {
    compositor_state: CompositorState,
    xdg_shell_state: XdgShellState,
    shm_state: ShmState,
    seat_state: SeatState<State>,
}

impl CompositorHandler for State {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }

    fn client_compositor_state<'a>(&self, client: &'a Client) -> &'a CompositorClientState {
        // Retrieve the CompositorClientState from our wrapper struct
        &client.get_data::<ClientState>().unwrap().compositor_state
    }

    fn commit(&mut self, surface: &WlSurface) {
        on_commit_buffer_handler::<Self>(surface);
    }
}

impl BufferHandler for State {
    fn buffer_destroyed(&mut self, _buffer: &WlBuffer) {}
}

impl XdgShellHandler for State {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState {
        &mut self.xdg_shell_state
    }
    fn new_toplevel(&mut self, _surface: ToplevelSurface) {
    }
    fn new_popup(&mut self, _surface: PopupSurface, _positioner: PositionerState) {
    }
    fn grab(&mut self, _surface: PopupSurface, _seat: WlSeat, _serial: Serial) {
    }
    fn reposition_request(&mut self, _surface: PopupSurface, _positioner: PositionerState, _token: u32) {
    }
}

impl ShmHandler for State {
    fn shm_state(&self) -> &ShmState {
        &self.shm_state
    }
}

impl SeatHandler for State {
    type KeyboardFocus = WlSurface;
    type PointerFocus = WlSurface;
    type TouchFocus = WlSurface;

    fn seat_state(&mut self) -> &mut SeatState<State> {
        &mut self.seat_state
    }

    fn focus_changed(&mut self, _seat: &Seat<State>, _focused: Option<&WlSurface>) {
    }
    fn cursor_image(&mut self, _seat: &Seat<State>, _image: CursorImageStatus) {
    }
}

delegate_compositor!(State);
delegate_xdg_shell!(State);
delegate_shm!(State);
delegate_seat!(State);

fn main() {
    let decorator = slog_term::TermDecorator::new().build();
    let drain = slog_term::FullFormat::new(decorator).build().fuse();
    let drain = slog_async::Async::new(drain).build().fuse();
    let _log = slog::Logger::root(drain, slog::o!());

    let _guard = slog_stdlog::init().ok();

    log::info!("Starting Blue Environment Compositor...");

    let mut display: Display<State> = Display::new().expect("Failed to create display");
    let display_handle: DisplayHandle = display.handle();

    // Init winit backend with GlesRenderer.
    // Init takes no arguments in 0.4.
    let (mut _backend, mut winit_input) = winit::init::<GlesRenderer>().expect("Failed to init winit backend");

    let mut state = State {
        compositor_state: CompositorState::new::<State>(&display_handle),
        xdg_shell_state: XdgShellState::new::<State>(&display_handle),
        shm_state: ShmState::new::<State>(&display_handle, vec![]),
        seat_state: SeatState::new(),
    };

    log::info!("Compositor initialized.");

    loop {
        display.dispatch_clients(&mut state).unwrap();
        // dispatch_new_events returns PumpStatus (not a Result)
        winit_input.dispatch_new_events(|_event| {});
    }
}
