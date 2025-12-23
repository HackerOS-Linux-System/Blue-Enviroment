use std::collections::HashMap;
use std::error::Error;
use std::os::unix::io::OwnedFd;
use std::os::fd::BorrowedFd;
use std::sync::Arc;
use std::time::Instant;
use smithay::{
    backend::allocator::dmabuf::Dmabuf,
    desktop::{
        layer_map_for_output, LayerSurface as DesktopLayerSurface, PopupKind,
        PopupManager, Space, Window,
    },
    input::{Seat, SeatHandler, SeatState},
    output::{Output, PhysicalProperties, Subpixel},
    reexports::{
        wayland_server::{
            backend::{ClientData, ClientId, DisconnectReason},
            protocol::{wl_buffer::WlBuffer, wl_output::WlOutput, wl_seat::WlSeat, wl_surface::WlSurface},
            Client, Display, DisplayHandle,
        },
        wayland_protocols::xdg::decoration::zv1::server::zxdg_toplevel_decoration_v1::Mode as DecorationMode,
    },
    utils::{Logical, Rectangle, Serial},
    wayland::{
        buffer::BufferHandler,
        compositor::{CompositorClientState, CompositorHandler, CompositorState},
        dmabuf::{DmabufGlobal, DmabufHandler, DmabufState, ImportNotifier},
        output::{OutputHandler, OutputManagerState},
        selection::{SelectionHandler, SelectionSource, SelectionTarget},
        selection::data_device::{
            DataDeviceHandler, DataDeviceState, WaylandDndGrabHandler
        },
        shell::{
            wlr_layer::{Layer, LayerSurface, WlrLayerShellHandler, WlrLayerShellState},
            xdg::{
                decoration::{XdgDecorationHandler, XdgDecorationState},
                PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
            },
        },
        shm::{ShmHandler, ShmState},
        socket::ListeningSocketSource,
    },
    xwayland::{
        xwm::{Reorder, ResizeEdge, XwmId},
        X11Surface, X11Wm, XWayland, XWaylandClientData, XWaylandEvent, XwmHandler,
    },
    wayland::xwayland_shell::{XWaylandShellHandler, XWaylandShellState},
};
use smithay::reexports::calloop::{EventLoop, Interest, Mode, PostAction, generic::Generic};
use smithay::input::dnd::DndGrabHandler;
use std::cell::RefCell;
use std::rc::Rc;
use std::process::Stdio;
use log::info;
smithay::delegate_compositor!(BlueCompositorState);
smithay::delegate_shm!(BlueCompositorState);
smithay::delegate_xdg_shell!(BlueCompositorState);
smithay::delegate_xdg_decoration!(BlueCompositorState);
smithay::delegate_layer_shell!(BlueCompositorState);
smithay::delegate_dmabuf!(BlueCompositorState);
smithay::delegate_seat!(BlueCompositorState);
smithay::delegate_output!(BlueCompositorState);
smithay::delegate_data_device!(BlueCompositorState);
smithay::delegate_xwayland_shell!(BlueCompositorState);
#[derive(Debug)]
struct BlueCompositorState {
    display: Rc<RefCell<Display<BlueCompositorState>>>,
    display_handle: DisplayHandle,
    compositor_state: CompositorState,
    xdg_shell_state: XdgShellState,
    shm_state: ShmState,
    dmabuf_state: Option<DmabufState>,
    xdg_decoration_state: XdgDecorationState,
    wlr_layer_shell_state: WlrLayerShellState,
    output_manager_state: OutputManagerState,
    seat_state: SeatState<Self>,
    space: Space<Window>,
    popups: PopupManager,
    seat: Seat<Self>,
    start_time: Instant,
    xwayland_client: Option<Client>,
    xwm: Option<Arc<X11Wm>>,
    theme: Theme,
    data_device_state: DataDeviceState,
    xwayland_shell_state: XWaylandShellState,
    tiling: bool,
    alt_pressed: bool,
    mouse_view: Option<Window>,
    grabbed_view: Option<Window>,
    grab_pos: Point<i32, Logical>,
}
#[derive(Debug, Clone)]
struct Theme {
    background_color: (f32, f32, f32, f32),
    window_border_color: (f32, f32, f32, f32),
    text_color: (f32, f32, f32, f32),
}
impl Default for Theme {
    fn default() -> Self {
        Theme {
            background_color: (0.1, 0.1, 0.1, 1.0),
            window_border_color: (0.2, 0.4, 0.8, 1.0),
            text_color: (0.9, 0.9, 0.9, 1.0),
        }
    }
}
#[derive(Default, Debug)]
struct ClientState {
    compositor_state: CompositorClientState,
}
impl ClientData for ClientState {
    fn initialized(&self, _client_id: ClientId) {}
    fn disconnected(&self, _client_id: ClientId, _reason: DisconnectReason) {}
}
impl CompositorHandler for BlueCompositorState {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }
    fn client_compositor_state<'a>(&self, client: &'a Client) -> &'a CompositorClientState {
        if let Some(state) = client.get_data::<ClientState>() {
            &state.compositor_state
        } else if let Some(state) = client.get_data<XWaylandClientData>() {
            &state.compositor_state
        } else {
            panic!("Unknown client data");
        }
    }
    fn commit(&mut self, surface: &WlSurface) {
        self.popups.commit(surface);
        if let Some((o, layer)) = self.space.outputs().find_map(|o| {
            let map = layer_map_for_output(o);
            let layer = map.layers().find(|l| l.wl_surface() == surface);
            layer.map(|l| (o.clone(), l.clone()))
        }) {
            layer.send_frame(&o, self.start_time.elapsed(), None, |_, _| Some(o.clone()));
        }
    }
}
impl ShmHandler for BlueCompositorState {
    fn shm_state(&self) -> &ShmState {
        &self.shm_state
    }
}
impl SeatHandler for BlueCompositorState {
    type KeyboardFocus = WlSurface;
    type PointerFocus = WlSurface;
    type TouchFocus = WlSurface;
    fn seat_state(&mut self) -> &mut SeatState<Self> {
        &mut self.seat_state
    }
    fn focus_changed(&mut self, _seat: &Seat<Self>, focused: Option<&Self::KeyboardFocus>) {
        if let Some(surface) = focused {
            if let Some(window) = self.space.elements().find(|w| w.toplevel().wl_surface() == surface) {
                self.space.raise_element(window, true);
            }
        }
    }
    fn cursor_image(&mut self, _seat: &Seat<Self>, _image: smithay::input::pointer::CursorImageStatus) {}
}
impl XdgShellHandler for BlueCompositorState {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState {
        &mut self.xdg_shell_state
    }
    fn new_toplevel(&mut self, surface: ToplevelSurface) {
        let window = Window::new_wayland_window(surface.clone());
        let surface = surface.wl_surface().clone();
        let loc = (rand::thread_rng().gen_range(0..800), rand::thread_rng().gen_range(0..600));
        self.space.map_element(window.clone(), loc, false);
        if surface.client().and_then(|c| c.get_data::<ClientState>()).map(|state| state.compositor_state).is_some() {
            if surface.app_id() == Some("terminal".to_string()) {
                self.space.map_element(window, (100, 100), false);
            }
        }
        if self.tiling {
            self.arrange();
        }
    }
    fn new_popup(&mut self, surface: PopupSurface, positioner: PositionerState) {
        surface.with_pending_state(|state| {
            state.geometry = positioner.get_geometry();
        });
        if let Err(err) = self.popups.track_popup(PopupKind::from(surface)) {
            log::warn!("Failed to track popup: {}", err);
        }
    }
    fn grab(&mut self, _surface: PopupSurface, _seat: WlSeat, _serial: Serial) {}
    fn reposition_request(&mut self, _surface: PopupSurface, _positioner: PositionerState, _token: u32) {}
}
impl XdgDecorationHandler for BlueCompositorState {
    fn new_decoration(&mut self, toplevel: ToplevelSurface) {
        toplevel.with_pending_state(|state| {
            state.decoration_mode = Some(DecorationMode::ServerSide);
        });
        toplevel.send_pending_configure();
    }
    fn request_mode(&mut self, _toplevel: ToplevelSurface, _mode: DecorationMode) {}
    fn unset_mode(&mut self, _toplevel: ToplevelSurface) {}
}
impl WlrLayerShellHandler for BlueCompositorState {
    fn shell_state(&mut self) -> &mut WlrLayerShellState {
        &mut self.wlr_layer_shell_state
    }
    fn new_layer_surface(
        &mut self,
        surface: LayerSurface,
        output: Option<WlOutput>,
        _layer: Layer,
        namespace: String,
    ) {
        let output = output
        .and_then(|o| self.space.outputs().find(|op| op.user_data().get::<WlOutput>().map(|u| u == &o).unwrap_or(false)).cloned())
        .unwrap_or_else(|| self.space.outputs().next().cloned().unwrap());
        let layer = DesktopLayerSurface::new(surface, namespace);
        layer_map_for_output(&output).map_layer(&layer).unwrap();
    }
}
impl BufferHandler for BlueCompositorState {
    fn buffer_destroyed(&mut self, _buffer: &WlBuffer) {}
}
impl DmabufHandler for BlueCompositorState {
    fn dmabuf_state(&mut self) -> &mut DmabufState {
        self.dmabuf_state.as_mut().unwrap()
    }
    fn dmabuf_imported(&mut self, _global: &DmabufGlobal, _dmabuf: Dmabuf, notifier: ImportNotifier) {
        notifier.successful::<Self>();
    }
}
impl OutputHandler for BlueCompositorState {}
impl XwmHandler for BlueCompositorState {
    fn xwm_state(&mut self, _xwm_id: XwmId) -> &mut X11Wm {
        Arc::get_mut(self.xwm.as_mut().unwrap()).unwrap()
    }
    fn new_window(&mut self, _xwm_id: XwmId, window: X11Surface) {
        let w = Window::new_x11_window(window);
        self.space.map_element(w, (0, 0), false);
    }
    fn new_override_redirect_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn map_window_request(&mut self, _xwm_id: XwmId, window: X11Surface) {
        let w = Window::new_x11_window(window);
        self.space.map_element(w, (0, 0), false);
    }
    fn mapped_override_redirect_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn unmapped_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn destroyed_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn configure_request(
        &mut self,
        _xwm_id: XwmId,
        _window: X11Surface,
        _x: Option<i32>,
        _y: Option<i32>,
        _w: Option<u32>,
        _h: Option<u32>,
        _reorder: Option<Reorder>,
    ) {}
    fn configure_notify(
        &mut self,
        _xwm_id: XwmId,
        _window: X11Surface,
        _geometry: Rectangle<i32, Logical>,
        _above: Option<u32>,
    ) {}
    fn resize_request(&mut self, _xwm_id: XwmId, _window: X11Surface, _button: u32, _resize_edge: ResizeEdge) {}
    fn move_request(&mut self, _xwm_id: XwmId, _window: X11Surface, _button: u32) {}
}
impl DataDeviceHandler for BlueCompositorState {
    fn data_device_state(&mut self) -> &mut DataDeviceState {
        &mut self.data_device_state
    }
}
impl SelectionHandler for BlueCompositorState {
    type SelectionUserData = ();
    fn new_selection(
        &mut self,
        _ty: SelectionTarget,
        _source: Option<SelectionSource>,
        _seat: Seat<Self>,
    ) {}
    fn send_selection(
        &mut self,
        _ty: SelectionTarget,
        _mime_type: String,
        _fd: OwnedFd,
        _seat: Seat<Self>,
        _user_data: &Self::SelectionUserData,
    ) {}
}
impl WaylandDndGrabHandler for BlueCompositorState {}
impl DndGrabHandler for BlueCompositorState {}
impl XWaylandShellHandler for BlueCompositorState {
    fn xwayland_shell_state(&mut self) -> &mut XWaylandShellState {
        &mut self.xwayland_shell_state
    }
    fn surface_associated(&mut self, _xwm_id: XwmId, _surface: WlSurface, _x11_surface: X11Surface) {}
}
impl BlueCompositorState {
    fn toggle_tiling(&mut self) {
        self.tiling = !self.tiling;
        if self.tiling {
            self.arrange();
        } else {
            for window in self.space.elements() {
                let loc = (rand::thread_rng().gen_range(0..800), rand::thread_rng().gen_range(0..600));
                self.space.map_element(window.clone(), loc, false);
            }
        }
    }
    fn arrange(&mut self) {
        if let Some(output) = self.space.outputs().next() {
            let size = output.current_mode().unwrap().size;
            let n = self.space.elements().count();
            if n == 0 {
                return;
            }
            let w = size.w / n as i32;
            let mut x = 0;
            for window in self.space.elements() {
                self.space.map_element(window.clone(), (x, 0), false);
                let new_size = (w, size.h);
                window.toplevel().with_pending_state(|state| {
                    state.size = Some(new_size.into());
                });
                window.toplevel().send_pending_configure();
                x += w;
            }
        }
    }
    fn view_at(&mut self, position: Point<i32, Logical>) -> Option<Window> {
        self.space.elements().rev().find(|w| w.geometry().contains(position)).cloned()
    }
    fn raise(&mut self, window: Window) {
        self.space.raise_element(&window, true);
        self.seat.get_keyboard().unwrap().set_focus(self, Some(window.toplevel().wl_surface().clone()), Serial::from(0));
    }
    fn handle_mouse_press(&mut self, position: Point<i32, Logical>, button: u32) {
        if self.mouse_view.is_none() {
            if let Some(view) = self.view_at(position) {
                self.mouse_view = Some(view.clone());
                self.raise(view.clone());
            }
        }
        self.seat.get_pointer().unwrap().move_to(self.mouse_view.as_ref().map(|v| v.toplevel().wl_surface().clone()), position);
        self.seat.get_pointer().unwrap().button(self, button, Serial::from(0));
        if button == 272 && self.alt_pressed && self.mouse_view.is_some() {
            self.grabbed_view = self.mouse_view.clone();
            self.grab_pos = position - self.space.element_location(&self.mouse_view.unwrap()).unwrap();
            self.seat.get_pointer().unwrap().button(self, button, Serial::from(0)); // release to not send to client
            return;
        }
    }
    fn handle_mouse_release(&mut self, position: Point<i32, Logical>, button: u32, buttons: u32) {
        self.seat.get_pointer().unwrap().move_to(self.mouse_view.as_ref().map(|v| v.toplevel().wl_surface().clone()), position);
        self.seat.get_pointer().unwrap().button(self, button, Serial::from(0));
        if self.grabbed_view.is_some() {
            self.grabbed_view = None;
        }
        if buttons == 0 {
            let new_view = self.view_at(position);
            if new_view != self.mouse_view {
                self.seat.get_pointer().unwrap().move_to(new_view.as_ref().map(|v| v.toplevel().wl_surface().clone()), position);
            }
            self.mouse_view = None;
        }
    }
    fn handle_mouse_move(&mut self, position: Point<i32, Logical>) {
        if let Some(grabbed) = &self.grabbed_view {
            self.space.map_element(grabbed.clone(), position - self.grab_pos, false);
            return;
        }
        let view = self.mouse_view.clone().or_else(|| self.view_at(position));
        self.seat.get_pointer().unwrap().move_to(view.as_ref().map(|v| v.toplevel().wl_surface().clone()), position);
    }
    fn handle_key_press(&mut self, key: u32) {
        if key == 64 || key == 108 {
            self.alt_pressed = true;
        }
        if let Some(keyboard) = self.seat.get_keyboard() {
            keyboard.input(self, key, true, Serial::from(0), self.start_time.elapsed());
        }
        if key == 16 && keyboard.modifiers().ctrl {
            std::process::exit(0);
        }
        if key == 28 && keyboard.modifiers().ctrl {
            self.toggle_tiling();
        }
    }
    fn handle_key_release(&mut self, key: u32) {
        if key == 64 || key == 108 {
            self.alt_pressed = false;
        }
        if let Some(keyboard) = self.seat.get_keyboard() {
            keyboard.input(self, key, false, Serial::from(0), self.start_time.elapsed());
        }
    }
}
fn main() -> Result<(), Box<dyn Error>> {
    env_logger::init();
    let mut display: Display<BlueCompositorState> = Display::new()?;
    let display_handle = display.handle();
    let poll_fd = display.backend().poll_fd().try_clone_to_owned()?;
    let mut event_loop: EventLoop<BlueCompositorState> = EventLoop::try_new()?;
    let loop_handle = event_loop.handle();
    let socket_source = ListeningSocketSource::new_auto()?;
    let socket_name = socket_source.socket_name().to_os_string();
    info!("Listening on {:?}", socket_name);
    loop_handle.insert_source(socket_source, |stream, _, state| {
        state
        .display
        .borrow()
        .handle()
        .insert_client(stream, Arc::new(ClientState::default()))
        .unwrap();
    })?;
    let wayland_source = Generic::new(poll_fd, Interest::READ, Mode::Level);
    loop_handle.insert_source(wayland_source, |_, _, state| {
        let display = state.display.clone();
        display.borrow_mut().dispatch_clients(state).unwrap();
        Ok(PostAction::Continue)
    })?;
    let mut seat_state = SeatState::new();
    let seat = seat_state.new_wl_seat(&display_handle, "seat0");
    let mut state = BlueCompositorState {
        display: Rc::new(RefCell::new(display)),
        display_handle: display_handle.clone(),
        compositor_state: CompositorState::new::<BlueCompositorState>(&display_handle),
        xdg_shell_state: XdgShellState::new::<BlueCompositorState>(&display_handle),
        shm_state: ShmState::new::<BlueCompositorState>(&display_handle, vec![]),
        dmabuf_state: None,
        xdg_decoration_state: XdgDecorationState::new::<BlueCompositorState>(&display_handle),
        wlr_layer_shell_state: WlrLayerShellState::new::<BlueCompositorState>(&display_handle),
        output_manager_state: OutputManagerState::new_with_xdg_output::<BlueCompositorState>(&display_handle),
        seat_state,
        space: Space::default(),
        popups: PopupManager::default(),
        seat,
        start_time: Instant::now(),
        xwayland_client: None,
        xwm: None,
        theme: Theme::default(),
        data_device_state: DataDeviceState::new::<BlueCompositorState>(&display_handle),
        xwayland_shell_state: XWaylandShellState::new::<BlueCompositorState>(&display_handle),
        tiling: false,
        alt_pressed: false,
        mouse_view: None,
        grabbed_view: None,
        grab_pos: (0, 0).into(),
    };
    let mut dmabuf_state = DmabufState::new();
    let _dmabuf_global = dmabuf_state.create_global::<BlueCompositorState>(&display_handle, vec![]);
    state.dmabuf_state = Some(dmabuf_state);
    let output = Output::new(
        "blue-1".into(),
                             PhysicalProperties {
                                 size: (1920, 1080).into(),
                             subpixel: Subpixel::Unknown,
                             make: "Blue Environment".into(),
                             model: "Virtual-1".into(),
                             serial_number: "0".to_string(),
                             },
    );
    let _global = output.create_global::<BlueCompositorState>(&display_handle);
    state.space.map_output(&output, (0, 0));
    let (xwayland, xwayland_client) = XWayland::spawn::<String, String, Vec<(String, String)>, _>(
        &display_handle,
        None,
        vec![],
        true,
        Stdio::null(),
                                                                                                  Stdio::null(),
                                                                                                  |_| {},
    )?;
    state.xwayland_client = Some(xwayland_client);
    let xwayland_loop_handle = loop_handle.clone();
    loop_handle.insert_source(
        xwayland,
        move |event, _, state| {
            match event {
                XWaylandEvent::Ready {
                    x11_socket,
                    display_number,
                } => {
                    let xwm = X11Wm::start_wm(
                        xwayland_loop_handle.clone(),
                                              &state.display_handle,
                                              x11_socket,
                                              state.xwayland_client.clone().unwrap(),
                    )
                    .unwrap();
                    state.xwm = Some(Arc::new(xwm));
                    info!("XWayland ready on display :{}", display_number);
                }
                XWaylandEvent::Error => {
                    log::error!("XWayland error");
                }
            }
        },
    )?;
    event_loop.run(None, &mut state, |state| {
        state.display.borrow_mut().flush_clients().unwrap();
    })?;
    Ok(())
}

