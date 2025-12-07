use std::error::Error;
use std::sync::Arc;
use log::info;
use smithay::{
    desktop::{layer_map_for_output, LayerSurface as DesktopLayerSurface, PopupKind, PopupManager, Space, Window},
    input::{Seat, SeatHandler, SeatState},
    output::{Output, PhysicalProperties, Subpixel, Mode},
    reexports::{
        calloop::{EventLoop, timer::{Timer, TimeoutAction}},
        wayland_server::{
            Display, DisplayHandle,
            protocol::{wl_output::WlOutput, wl_surface::WlSurface, wl_seat::WlSeat, wl_buffer::WlBuffer},
        },
        wayland_protocols::xdg::decoration::zv1::server::zxdg_toplevel_decoration_v1::Mode as DecorationMode,
    },
    utils::{Logical, Rectangle, Serial, Size, Point},
    wayland::{
        buffer::BufferHandler,
        compositor::{CompositorState, CompositorHandler, CompositorClientState},
        dmabuf::{DmabufHandler, DmabufState, ImportNotifier},
        output::{OutputHandler, OutputManagerState},
        selection::{SelectionHandler, SelectionSource, SelectionTarget},
        selection::data_device::{DataDeviceHandler, DataDeviceState, WaylandDndGrabHandler},
        shell::{
            wlr_layer::{Layer, LayerSurface, WlrLayerShellHandler, WlrLayerShellState},
            xdg::{
                decoration::{XdgDecorationHandler, XdgDecorationState},
                PopupSurface, PositionerState, ToplevelSurface, XdgShellHandler, XdgShellState,
            },
        },
        shm::{ShmHandler, ShmState},
        socket::ListeningSocketSource,
        xwayland_shell::{XWaylandShellHandler, XWaylandShellState},
    },
    xwayland::{XWayland, X11Wm, XwmHandler, X11Surface},
    xwayland::xwm::{Reorder, ResizeEdge, XwmId},
    reexports::wayland_server::Client,
};
use std::time::Duration;
use std::process::Stdio;
use std::os::unix::io::OwnedFd;
use smithay::input::dnd::{DndGrabHandler, DndTarget, GrabType, Source};
use smithay::reexports::wayland_server::protocol::wl_surface::WlSurface as WaylandSurface;

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
    start_time: std::time::Instant,
    xwayland: Option<XWayland>,
    xwayland_client: Option<Client>,
    xwm: Option<Arc<X11Wm>>,
    theme: Theme,
    data_device_state: DataDeviceState,
    xwayland_shell_state: XWaylandShellState,
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

impl wayland_server::backend::ClientData for ClientState {
    fn initialized(&self, _client_id: wayland_server::backend::ClientId) {}
    fn disconnected(&self, _client_id: wayland_server::backend::ClientId, _reason: wayland_server::backend::DisconnectReason) {}
}

// === Handlers ===

impl CompositorHandler for BlueCompositorState {
    fn compositor_state(&mut self) -> &mut CompositorState {
        &mut self.compositor_state
    }
    fn client_compositor_state<'a>(&self, client: &'a wayland_server::Client) -> &'a CompositorClientState {
        &client.get_data::<ClientState>().unwrap().compositor_state
    }
    fn commit(&mut self, _surface: &WlSurface) {
        // Wszystko obsługiwane automatycznie przez Space/PopupManager
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
    fn focus_changed(&mut self, _seat: &Seat<Self>, _focused: Option<&Self::KeyboardFocus>) {}
    fn cursor_image(&mut self, _seat: &Seat<Self>, _image: smithay::input::pointer::CursorImageStatus) {}
}

impl XdgShellHandler for BlueCompositorState {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState {
        &mut self.xdg_shell_state
    }
    fn new_toplevel(&mut self, surface: ToplevelSurface) {
        let window = Window::new_wayland_window(surface);
        self.space.map_element(window.clone(), (0, 0), true);
    }
    fn new_popup(&mut self, surface: PopupSurface, positioner: PositionerState) {
        surface.with_pending_state(|state| {
            state.geometry = positioner.get_geometry();
        });
        surface.send_configure();
        let _ = self.popups.track_popup(PopupKind::Xdg(surface));
    }
    fn grab(&mut self, _surface: PopupSurface, _seat: WlSeat, _serial: Serial) {}
    fn reposition_request(&mut self, _surface: PopupSurface, _positioner: PositionerState, _token: u32) {}
}

impl XdgDecorationHandler for BlueCompositorState {
    fn new_decoration(&mut self, toplevel: ToplevelSurface) {
        toplevel.with_pending_state(|state| {
            state.decoration_mode = Some(DecorationMode::ServerSide);
        });
        toplevel.send_configure();
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
        let desktop_layer = DesktopLayerSurface::new(surface, namespace);
        let output = output
        .and_then(|o| self.space.outputs().find(|op| op.owns(&o)).cloned())
        .unwrap_or_else(|| self.space.outputs().next().cloned().unwrap());
        let mut map = layer_map_for_output(&output);
        map.map_layer(&desktop_layer);
    }
}

impl BufferHandler for BlueCompositorState {
    fn buffer_destroyed(&mut self, _buffer: &WlBuffer) {}
}

impl DmabufHandler for BlueCompositorState {
    fn dmabuf_state(&mut self) -> &mut DmabufState {
        self.dmabuf_state.as_mut().unwrap()
    }
    fn dmabuf_imported(&mut self, _global: &smithay::wayland::dmabuf::DmabufGlobal, _dmabuf: smithay::backend::allocator::dmabuf::Dmabuf, notifier: ImportNotifier) {
        let _ = notifier.successful::<Self>();
    }
}

impl OutputHandler for BlueCompositorState {}

impl XwmHandler for BlueCompositorState {
    fn xwm_state(&mut self, _xwm_id: XwmId) -> &mut X11Wm {
        Arc::get_mut(self.xwm.as_mut().unwrap()).unwrap()
    }
    fn new_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn new_override_redirect_window(&mut self, _xwm_id: XwmId, _window: X11Surface) {}
    fn map_window_request(&mut self, _xwm_id: XwmId, window: X11Surface) {
        let w = Window::new_x11_window(window);
        self.space.map_element(w, (0, 0), true);
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
        _width: Option<u32>,
        _height: Option<u32>,
        _reorder: Option<Reorder>,
    ) {}
    fn configure_notify(
        &mut self,
        _xwm_id: XwmId,
        _window: X11Surface,
        _geometry: Rectangle<i32, Logical>,
        _above: Option<u32>,
    ) {}
    fn resize_request(
        &mut self,
        _xwm_id: XwmId,
        _window: X11Surface,
        _button: u32,
        _edges: ResizeEdge,
    ) {}
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
    ) {
    }
    fn send_selection(
        &mut self,
        _ty: SelectionTarget,
        _mime_type: String,
        _fd: OwnedFd,
        _seat: Seat<Self>,
        _user_data: &Self::SelectionUserData,
    ) {
    }
}

impl WaylandDndGrabHandler for BlueCompositorState {
    fn dnd_requested<S: Source>(
        &mut self,
        source: S,
        _icon: Option<WaylandSurface>,
        _seat: Seat<Self>,
        _serial: Serial,
        _type_: GrabType,
    ) {
        source.cancel();
    }
}

impl DndGrabHandler for BlueCompositorState {
    fn dropped(&mut self, _target: Option<DndTarget<'_, Self>>, _validated: bool, _seat: Seat<Self>, _location: Point<f64, Logical>) {
    }
}

impl XWaylandShellHandler for BlueCompositorState {
    fn xwayland_shell_state(&mut self) -> &mut XWaylandShellState {
        &mut self.xwayland_shell_state
    }
}

// === Main ===

fn main() -> Result<(), Box<dyn Error>> {
    env_logger::init();
    let mut event_loop = EventLoop::<BlueCompositorState>::try_new()?;
    let loop_handle = event_loop.handle();
    let display = Display::<BlueCompositorState>::new()?;
    let display_handle = display.handle();
    let mut seat_state = SeatState::<BlueCompositorState>::new();
    let seat = seat_state.new_wl_seat(&display_handle, "seat0");
    let mut state = BlueCompositorState {
        display_handle: display_handle.clone(),
        compositor_state: CompositorState::new(&display_handle),
        xdg_shell_state: XdgShellState::new::<BlueCompositorState>(&display_handle),
        shm_state: ShmState::new(&display_handle, vec![]),
        dmabuf_state: None,
        xdg_decoration_state: XdgDecorationState::new::<BlueCompositorState>(&display_handle),
        wlr_layer_shell_state: WlrLayerShellState::new::<BlueCompositorState>(&display_handle),
        output_manager_state: OutputManagerState::new_with_xdg_output(&display_handle),
        seat_state,
        space: Space::default(),
        popups: PopupManager::default(),
        seat,
        start_time: std::time::Instant::now(),
        xwayland: None,
        xwayland_client: None,
        xwm: None,
        theme: Theme::default(),
        data_device_state: DataDeviceState::new(&display_handle),
        xwayland_shell_state: XWaylandShellState::new(&display_handle),
    };
    // Dmabuf global
    let mut dmabuf_state = DmabufState::new();
    let _dmabuf_global = dmabuf_state.create_global::<BlueCompositorState>(&display_handle, vec![]);
    state.dmabuf_state = Some(dmabuf_state);
    // Dummy output
    let output = Output::new(
        "blue-1".to_string(),
                             PhysicalProperties {
                                 size: Size::from((1920, 1080)),
                             subpixel: Subpixel::Unknown,
                             make: "Blue Environment".to_string(),
                             model: "Virtual-1".to_string(),
                             serial_number: "unknown".to_string(),
                             },
    );
    let mode = Mode {
        size: Size::from((1920, 1080)),
        refresh: 60_000,
    };
    output.change_current_state(Some(mode), None, None, Some((0, 0).into()));
    output.set_preferred(mode);
    state.space.map_output(&output, (0, 0));
    // Wayland socket
    let socket_source = ListeningSocketSource::new_auto()?;
    let socket_name = socket_source.socket_name().to_os_string();
    info!("Listening on {socket_name:?}");
    loop_handle.insert_source(socket_source, move |client_stream, _, state| {
        state.display_handle.insert_client(client_stream, Arc::new(ClientState::default())).unwrap();
    })?;
    // XWayland
    let loop_handle_clone = loop_handle.clone();
    let (xwayland, wl_connection) = XWayland::spawn(
        &display_handle,
        None,
        std::env::vars(),
                                                    true,
                                                    Stdio::null(),
                                                    Stdio::null(),
                                                    |_| {},
    )?;
    let wl_client = state.display_handle.insert_client(wl_connection, Arc::new(ClientState::default()))?;
    state.xwayland = Some(xwayland);
    state.xwayland_client = Some(wl_client);
    loop_handle.insert_source(
        Timer::immediate(),
                              move |_, _, state| {
                                  if let Some(connection_res) = state.xwayland.as_mut().unwrap().take_socket() {
                                      match connection_res {
                                          Ok(Some(connection)) => {
                                              let xwm = match X11Wm::start_wm(
                                                  loop_handle_clone.clone(),
                                                                              &state.display_handle,
                                                                              connection,
                                                                              state.xwayland_client.as_ref().unwrap().clone(),
                                              ) {
                                                  Ok(x) => x,
                              Err(e) => {
                                  log::error!("Failed to start XWM: {}", e);
                                  return TimeoutAction::ToDuration(Duration::from_millis(100));
                              }
                                              };
                                              state.xwm = Some(Arc::new(xwm));
                                              info!("XWayland is ready");
                                              TimeoutAction::Drop
                                          }
                                          Ok(None) => TimeoutAction::ToDuration(Duration::from_millis(100)),
                              Err(e) => {
                                  log::error!("Error taking XWayland socket: {}", e);
                                  TimeoutAction::ToDuration(Duration::from_millis(100))
                              }
                                      }
                                  } else {
                                      TimeoutAction::ToDuration(Duration::from_millis(100))
                                  }
                              },
    )?;
    event_loop.run(None, &mut state, |_| {})?;
    Ok(())
}
