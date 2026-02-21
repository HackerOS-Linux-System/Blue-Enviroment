use smithay::{
    delegate_compositor, delegate_data_device, delegate_output,
    delegate_seat, delegate_shm, delegate_xdg_shell, delegate_xdg_decoration,
    delegate_layer_shell, delegate_viewporter, delegate_fractional_scale,
    desktop::{Window, Space, PopupManager, PopupKind, LayerSurface},
    input::{
        Seat, SeatHandler, SeatState, pointer::{MotionEvent, CursorImageStatus, ButtonEvent as PointerButtonEvent, AxisFrame, GrabStartData as PointerGrabStartData, PointerGrab, Focus},
        keyboard::{KeyEvent, ModifiersState, XkbConfig, keysyms},
    },
    reexports::{
        calloop::{EventLoop, LoopHandle, generic::Generic, Interest, Mode, PostAction},
        wayland_server::{
            protocol::{wl_surface::WlSurface, wl_seat::WlSeat, wl_output::WlOutput, wl_buffer::WlBuffer},
            Display, DisplayHandle, Client, backend::{ClientData, ClientId, DisconnectReason},
        },
    },
    utils::{Serial, SERIAL_COUNTER, Clock, Monotonic, Transform, PhysicalProperties, Subpixel, Mode as DisplayMode, Point, Rectangle, Scale, Size, Logical},
    wayland::{
        buffer::BufferHandler,
        compositor::{CompositorHandler, CompositorState, CompositorClientState, on_commit_buffer_handler, with_states},
        data_device::{DataDeviceHandler, DataDeviceState},
        output::{OutputHandler, OutputState, Output, Scale as OutputScale},
        shell::{
            xdg::{XdgShellHandler, XdgShellState, ToplevelSurface, PopupSurface, PositionerState, DecorationMode, XdgToplevelSurfaceRoleAttributes},
            wlr_layer::{LayerShellHandler, LayerShellState, Layer as WlrLayer, LayerSurface as WlrLayerSurface},
        },
        shm::{ShmHandler, ShmState},
        socket::ListeningSocketSource,
        viewporter::{ViewporterState, ViewporterHandler},
        fractional_scale::{FractionalScaleHandler, FractionalScaleState},
    },
    backend::{
        input::{InputBackend, InputEvent, Keycode, PointerButtonEvent as BackendButtonEvent, PointerMotionAbsoluteEvent, PointerAxisEvent, ButtonState, Axis, AxisSource},
        winit::{self, WinitEvent, WinitGraphicsBackend, WinitInputBackend},
        renderer::{
            gles::GlesRenderer,
            element::{AsRenderElements, surface::WaylandSurfaceRenderElement},
            damage::{DamageTrackedRenderer, DamageTrackedRendererError, OutputDamageTracker},
            ImportAll, ImportMem,
        },
        allocator::Fourcc,
    },
    xwayland::{XWayland, XWaylandEvent},
};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::os::unix::io::OwnedFd;
use std::collections::HashMap;
use xkbcommon::xkb::{Context as XkbContext};
use tracing::{info, warn, error};
use smithay::wayland::shell::xdg::decoration::{XdgDecorationHandler, XdgDecorationState};
use smithay::wayland::compositor;
use smithay::input::pointer::CursorImageSurfaceData;
use smithay::backend::renderer::gles::GlesTexture;

#[derive(Default)]
pub struct ClientState {
    pub compositor_state: CompositorClientState,
}

impl ClientData for ClientState {
    fn initialized(&self, _client_id: ClientId) {}
    fn disconnected(&self, _client_id: ClientId, _reason: DisconnectReason) {}
}

pub struct BlueState {
    pub display_handle: DisplayHandle,
    pub compositor_state: CompositorState,
    pub xdg_shell_state: XdgShellState,
    pub shm_state: ShmState,
    pub output_state: OutputState,
    pub seat_state: SeatState<Self>,
    pub data_device_state: DataDeviceState,
    pub seat: Seat<Self>,
    pub space: Space<Window>,
    pub popup_manager: PopupManager,
    pub xdg_decoration_state: XdgDecorationState,
    pub layer_shell_state: LayerShellState,
    pub viewporter_state: ViewporterState,
    pub fractional_scale_state: FractionalScaleState,
    pub output: Output,
    pub clock: Clock<Monotonic>,
    pub loop_handle: LoopHandle<'static, Self>,
    pub winit_backend: Option<WinitGraphicsBackend<GlesRenderer>>,
    pub damage_tracker: OutputDamageTracker,
    pub pointer_location: Point<f64, Logical>,
    pub cursor_status: Arc<Mutex<CursorImageStatus>>,
    pub layers: HashMap<Output, Vec<LayerSurface>>,
    pub suppressed_keys: Vec<(u32, u32)>, // keycode, keysym
    pub key_modifiers: ModifiersState,
    pub xwayland: XWayland<Self>,
}

impl BlueState {
    pub fn new(display_handle: DisplayHandle, loop_handle: LoopHandle<'static, Self>) -> Self {
        let compositor_state = CompositorState::new::<Self>(&display_handle);
        let xdg_shell_state = XdgShellState::new::<Self>(&display_handle);
        let shm_state = ShmState::new::<Self>(&display_handle, vec![]);
        let output_state = OutputState::new::<Self>(&display_handle);
        let mut seat_state = SeatState::new();
        let data_device_state = DataDeviceState::new::<Self>(&display_handle);
        let mut seat = seat_state.new_wl_seat(&display_handle, "seat0");
        let xkb_config = XkbConfig::default();
        seat.add_keyboard(xkb_config, 200, 25).unwrap();
        seat.add_pointer();
        let output = Output::new("Winit".to_string(), PhysicalProperties {
            size: (0, 0).into(),
                                 subpixel: Subpixel::Unknown,
                                 make: "Smithay".to_string(),
                                 model: "Winit".to_string(),
        });
        let popup_manager = PopupManager::default();
        let xdg_decoration_state = XdgDecorationState::new::<Self>(&display_handle);
        let layer_shell_state = LayerShellState::new::<Self>(&display_handle);
        let viewporter_state = ViewporterState::new::<Self>(&display_handle);
        let fractional_scale_state = FractionalScaleState::new::<Self>(&display_handle);
        let cursor_status = Arc::new(Mutex::new(CursorImageStatus::Default));
        let xwayland = XWayland::new(display_handle.clone(), loop_handle.clone(), None);
        Self {
            display_handle,
            compositor_state,
            xdg_shell_state,
            shm_state,
            output_state,
            seat_state,
            data_device_state,
            seat,
            space: Space::default(),
            popup_manager,
            xdg_decoration_state,
            layer_shell_state,
            viewporter_state,
            fractional_scale_state,
            output,
            clock: Clock::new().expect("Failed to initialize clock"),
            loop_handle,
            winit_backend: None,
            damage_tracker: OutputDamageTracker::new((1920, 1080).into(), 1.0, Transform::Normal),
            pointer_location: (0.0, 0.0).into(),
            cursor_status,
            layers: HashMap::new(),
            suppressed_keys: Vec::new(),
            key_modifiers: ModifiersState::default(),
            xwayland,
        }
    }

    fn process_input_event<B: InputBackend>(&mut self, event: InputEvent<B>) {
        match event {
            InputEvent::Keyboard { event } => {
                let serial = SERIAL_COUNTER.next_serial();
                let time = self.clock.now().msec();
                let keyboard = self.seat.get_keyboard().unwrap();
                keyboard.input(self, event.key_code(), event.state(), serial, time, |state, modifiers, handle| {
                    state.key_modifiers = *modifiers;
                    if event.state() == ButtonState::Pressed {
                        let keysym = handle.modified_sym();
                        if modifiers.ctrl && modifiers.alt && keysym == keysyms::KEY_BackSpace {
                            state.loop_handle.insert_idle(|_| std::process::exit(0));
                            return smithay::input::keyboard::FilterResult::Intercept(());
                        }
                        // More shortcuts
                    }
                    smithay::input::keyboard::FilterResult::Forward
                });
            }
            InputEvent::PointerMotionAbsolute { event } => {
                let output_geo = self.space.output_geometry(&self.output).unwrap();
                let pos = event.position_transformed(output_geo.size) + output_geo.loc.to_f64();
                self.pointer_location = pos;
                let serial = SERIAL_COUNTER.next_serial();
                let pointer = self.seat.get_pointer().unwrap();
                let under = self.surface_under(pos);
                pointer.motion(self, under, &MotionEvent {
                    location: pos,
                    serial,
                    time: event.time_msec(),
                });
            }
            InputEvent::PointerButton { event } => {
                let serial = SERIAL_COUNTER.next_serial();
                let pointer = self.seat.get_pointer().unwrap();
                pointer.button(self, &PointerButtonEvent {
                    serial,
                    time: event.time_msec(),
                               button: event.button_code(),
                               state: event.state(),
                });
                if event.state() == ButtonState::Pressed {
                    if let Some((window, _)) = self.surface_under(self.pointer_location).map(|(s, p)| (self.window_for_surface(&s).unwrap(), p)) {
                        self.space.raise_element(&window, true);
                        self.seat.get_keyboard().unwrap().set_focus(self, Some(window), serial);
                    }
                }
            }
            InputEvent::PointerAxis { event } => {
                let serial = SERIAL_COUNTER.next_serial();
                let pointer = self.seat.get_pointer().unwrap();
                let source = event.source();
                let mut frame = AxisFrame::new(event.time_msec()).source(source);
                if let Some(amt) = event.amount(Axis::Horizontal) {
                    frame = frame.value(Axis::Horizontal, amt);
                } else if let Some(amt) = event.amount_discrete(Axis::Horizontal) {
                    frame = frame.discrete(Axis::Horizontal, amt as i32);
                }
                if let Some(amt) = event.amount(Axis::Vertical) {
                    frame = frame.value(Axis::Vertical, amt);
                } else if let Some(amt) = event.amount_discrete(Axis::Vertical) {
                    frame = frame.discrete(Axis::Vertical, amt as i32);
                }
                pointer.axis(self, frame, serial, event.time_msec());
            }
            _ => {}
        }
    }

    fn surface_under(&self, point: Point<f64, Logical>) -> Option<(WlSurface, Point<i32, Logical>)> {
        let output_geo = self.space.output_geometry(&self.output)?;
        if !output_geo.contains(point.to_i32_round()) {
            return None;
        }
        let point_local = point - output_geo.loc.to_f64();
        self.space.element_under(point_local).map(|(window, loc)| (window.wl_surface(), loc))
    }

    fn window_for_surface(&self, surface: &WlSurface) -> Option<Window> {
        self.space.elements().find(|w| w.has_surface(surface, smithay::desktop::WindowSurfaceType::ALL)).cloned()
    }

    fn render(&mut self) -> Result<(), DamageTrackedRendererError<GlesRenderer>> {
        let backend = self.winit_backend.as_mut().unwrap();
        let mut renderer = backend.renderer();
        let output = &self.output;
        let time = self.clock.now().msec();
        let scale = output.current_scale().fractional_scale();
        let output_rect = self.space.output_geometry(output).unwrap();
        let damage = vec![output_rect]; // Full damage for now

        let mut elements: Vec<WaylandSurfaceRenderElement<GlesRenderer>> = Vec::new();

        // Render layers
        if let Some(layers) = self.layers.get(output) {
            for layer in layers {
                let loc = layer.location();
                elements.extend(AsRenderElements::<GlesRenderer>::render_elements(layer, &mut renderer, loc, scale.into(), 1.0));
            }
        }

        // Render windows (without decorations for now, as custom rendering is complex)
        for window in self.space.elements() {
            let window_loc = self.space.element_location(window).unwrap();
            elements.extend(AsRenderElements::<GlesRenderer>::render_elements(window, &mut renderer, window_loc, scale.into(), 1.0));
        }

        // Render cursor
        let mut cursor_elements = Vec::new();
        let cursor_hotspot = match *self.cursor_status.lock().unwrap() {
            CursorImageStatus::Surface(ref surface) => {
                with_states(surface, |states| {
                    states.data_map.get::<CursorImageSurfaceData>().map(|data| data.hotspot)
                }).unwrap_or((0,0).into())
            }
            CursorImageStatus::Default => {
                // Render default cursor, load from theme or simple shape
                // For simplicity, skip or use a texture
                (0,0).into()
            }
            CursorImageStatus::Hidden => {
                return Ok(());
            }
        };
        // Assume we have a way to get cursor render elements
        // elements.extend(cursor_elements at pointer_location - hotspot);

        if let Ok(mut frame) = backend.bind() {
            self.damage_tracker.render_output(&mut renderer, time, &elements, [0.1, 0.1, 0.1, 1.0])?;
            frame.swap_buffers(Some(damage))?;
        }
        self.space.send_frames(time);
        backend.window().request_redraw();
        Ok(())
    }
}

delegate_compositor!(BlueState);
delegate_xdg_shell!(BlueState);
delegate_shm!(BlueState);
delegate_output!(BlueState);
delegate_seat!(BlueState);
delegate_data_device!(BlueState);
delegate_xdg_decoration!(BlueState);
delegate_layer_shell!(BlueState);
delegate_viewporter!(BlueState);
delegate_fractional_scale!(BlueState);

impl CompositorHandler for BlueState {
    fn compositor_state(&mut self) -> &mut CompositorState { &mut self.compositor_state }
    fn client_compositor_state<'a>(&self, client: &'a Client) -> &'a CompositorClientState {
        &client.get_data::<ClientState>().unwrap().compositor_state
    }
    fn commit(&mut self, surface: &WlSurface) {
        on_commit_buffer_handler(surface);
        self.space.commit(surface);
        self.popup_manager.commit(surface);
        ensure_initial_configure(self, surface);
        if let Some(window) = self.window_for_surface(surface) {
            if let Some(backend) = self.winit_backend.as_ref() {
                backend.window().request_redraw();
            }
        }
    }
}

fn ensure_initial_configure(state: &mut BlueState, surface: &WlSurface) {
    if let Some(toplevel) = state.space.elements().find(|w| &w.wl_surface() == surface).and_then(|w| w.toplevel().clone().into()) {
        toplevel.send_configure();
    } else if let Some(popup) = state.popup_manager.popups().find(|p| p.surface().wl_surface() == surface).cloned() {
        popup.send_configure();
    }
    // More for layer etc.
}

impl XdgShellHandler for BlueState {
    fn xdg_shell_state(&mut self) -> &mut XdgShellState { &mut self.xdg_shell_state }
    fn new_toplevel(&mut self, surface: ToplevelSurface) {
        let window = Window::new(surface.clone());
        let mut pos = (20, 20);
        for w in self.space.elements() {
            pos.0 += 20;
            pos.1 += 20;
        }
        self.space.map_element(window.clone(), pos, true);
        surface.with_pending_state(|state| {
            state.states.set(xdg_toplevel::State::Activated);
        });
        surface.send_configure();
        self.seat.get_keyboard().unwrap().set_focus(self, Some(window), SERIAL_COUNTER.next_serial());
    }
    fn new_popup(&mut self, surface: PopupSurface, positioner: PositionerState) {
        surface.with_pending_state(|state| {
            state.geometry = positioner.get_geometry();
            state.positioner = positioner;
        });
        if self.popup_manager.track_popup(PopupKind::Xdg(surface)).is_ok() {
            surface.send_configure();
        }
    }
    fn reposition_request(&mut self, surface: PopupSurface, positioner: PositionerState, token: u32) {
        surface.with_pending_state(|state| {
            state.geometry = positioner.get_geometry();
            state.positioner = positioner;
        });
        surface.send_repositioned(token);
        surface.send_configure();
    }
    fn grab(&mut self, surface: PopupSurface, seat: WlSeat, serial: Serial) {
        let seat: Seat<Self> = Seat::from_resource(&seat).unwrap();
        let kind = PopupKind::Xdg(surface.clone());
        if let Some(grab) = self.popup_manager.grab_popup(kind, &seat, serial) {
            let pointer = seat.get_pointer().unwrap();
            pointer.set_grab(self, grab, serial, Focus::Clear);
        }
    }
    fn move_request(&mut self, surface: ToplevelSurface, seat: WlSeat, serial: Serial) {
        let seat: Seat<Self> = Seat::from_resource(&seat).unwrap();
        let pointer = seat.get_pointer().unwrap();
        if pointer.has_grab(serial) {
            let start_data = pointer.grab_start_data().unwrap();
            let window = self.space.elements().find(|w| w.toplevel().wl_surface() == surface.wl_surface()).cloned().unwrap();
            let initial_location = self.space.element_location(&window).unwrap();
            let grab = MoveGrab {
                start_data,
                window,
                initial_location,
            };
            pointer.set_grab(self, grab, serial, Focus::Clear);
        }
    }
    fn resize_request(&mut self, surface: ToplevelSurface, seat: WlSeat, serial: Serial, edges: xdg_toplevel::ResizeEdge) {
        let seat: Seat<Self> = Seat::from_resource(&seat).unwrap();
        let pointer = seat.get_pointer().unwrap();
        if pointer.has_grab(serial) {
            let start_data = pointer.grab_start_data().unwrap();
            let window = self.space.elements().find(|w| w.toplevel().wl_surface() == surface.wl_surface()).cloned().unwrap();
            let initial_location = self.space.element_location(&window).unwrap();
            let initial_size = window.geometry().size;
            let grab = ResizeGrab {
                start_data,
                window,
                edges,
                initial_location,
                initial_size,
            };
            pointer.set_grab(self, grab, serial, Focus::Clear);
        }
    }
    fn fullscreen_request(&mut self, surface: ToplevelSurface, wl_output: Option<WlOutput>) {
        if let Some(output) = wl_output.and_then(Output::from_resource) {
            let geo = self.space.output_geometry(&output).unwrap_or_default();
            surface.with_pending_state(|state| {
                state.fullscreen_output = Some(output);
                state.bounds = Some(geo.size);
                state.states.set(xdg_toplevel::State::Fullscreen);
            });
            surface.send_configure();
        }
    }
    fn maximize_request(&mut self, surface: ToplevelSurface) {
        let geo = self.space.output_geometry(&self.output).unwrap_or_default();
        surface.with_pending_state(|state| {
            state.size = Some(geo.size);
            state.states.set(xdg_toplevel::State::Maximized);
        });
        surface.send_configure();
    }
    // Other methods like minimize, show_window_menu, etc.
}

struct MoveGrab {
    start_data: PointerGrabStartData<BlueState>,
    window: Window,
    initial_location: Point<i32, Logical>,
}

impl PointerGrab<BlueState> for MoveGrab {
    fn motion(&mut self, data: &mut BlueState, event: &MotionEvent) {
        let delta = event.location - self.start_data.location;
        let new_loc = self.initial_location + delta.to_i32_round();
        data.space.move_element(&self.window, new_loc);
    }
    fn relative_motion(&mut self, data: &mut BlueState, event: &smithay::input::pointer::RelativeMotionEvent) {
        // Handle if needed
    }
    fn button(&mut self, data: &mut BlueState, event: &PointerButtonEvent) {
        if event.state == ButtonState::Released {
            // Check if no buttons pressed
            // ungrab
        }
    }
    fn axis(&mut self, data: &mut BlueState, details: AxisFrame, time: u32) {
        // Handle
    }
    fn frame(&mut self, data: &mut BlueState) {
        // Handle
    }
    fn start_data(&self) -> &PointerGrabStartData<BlueState> {
        &self.start_data
    }
    // Implement all required methods
}

struct ResizeGrab {
    start_data: PointerGrabStartData<BlueState>,
    window: Window,
    edges: xdg_toplevel::ResizeEdge,
    initial_location: Point<i32, Logical>,
    initial_size: Size<i32, Logical>,
}

impl PointerGrab<BlueState> for ResizeGrab {
    fn motion(&mut self, data: &mut BlueState, event: &MotionEvent) {
        let delta = event.location - self.start_data.location;
        let mut new_loc = self.initial_location;
        let mut new_size = self.initial_size;
        if self.edges.contains(xdg_toplevel::ResizeEdge::Top) {
            new_loc.y += delta.y as i32;
            new_size.h -= delta.y as i32;
        }
        if self.edges.contains(xdg_toplevel::ResizeEdge::Bottom) {
            new_size.h += delta.y as i32;
        }
        if self.edges.contains(xdg_toplevel::ResizeEdge::Left) {
            new_loc.x += delta.x as i32;
            new_size.w -= delta.x as i32;
        }
        if self.edges.contains(xdg_toplevel::ResizeEdge::Right) {
            new_size.w += delta.x as i32;
        }
        let (min_size, max_size) = with_states(self.window.toplevel().wl_surface(), |states| {
            let attributes = states.data_map.get::<Mutex<XdgToplevelSurfaceRoleAttributes>>().unwrap().lock().unwrap();
            (attributes.min_size, attributes.max_size)
        });
        new_size = new_size.max(min_size).min(max_size);
        if new_size.w == 0 || new_size.h == 0 {
            new_size = (1,1).into();
        }
        data.space.move_element(&self.window, new_loc);
        self.window.toplevel().with_pending_state(|state| {
            state.size = Some(new_size);
        });
        self.window.toplevel().send_pending_configure();
    }
    // Implement other methods similarly
}

impl LayerShellHandler for BlueState {
    fn layer_shell_state(&mut self) -> &mut LayerShellState { &mut self.layer_shell_state }
    fn new_layer_surface(&mut self, surface: WlrLayerSurface, output: Option<WlOutput>, layer: WlrLayer, namespace: String) {
        let output = output.and_then(Output::from_resource).unwrap_or_else(|| self.output.clone());
        let layer_surface = LayerSurface::new(surface);
        self.layers.entry(output.clone()).or_default().push(layer_surface.clone());
        self.space.map_layer(&output, layer_surface, true, None);
        surface.send_configure();
    }
    // Other methods
}

impl XdgDecorationHandler for BlueState {
    fn xdg_decoration_state(&mut self) -> &mut XdgDecorationState { &mut self.xdg_decoration_state }
    fn new_decoration(&mut self, toplevel: ToplevelSurface) {
        toplevel.with_pending_state(|state| state.decoration_mode = Some(DecorationMode::ServerSide));
        toplevel.send_configure();
    }
    fn request_mode(&mut self, toplevel: ToplevelSurface, mode: DecorationMode) {
        toplevel.with_pending_state(|state| state.decoration_mode = Some(DecorationMode::ServerSide));
        toplevel.send_configure();
    }
    fn unset_mode(&mut self, toplevel: ToplevelSurface) {
        toplevel.with_pending_state(|state| state.decoration_mode = Some(DecorationMode::ServerSide));
        toplevel.send_configure();
    }
}

impl ViewporterHandler for BlueState {
    fn viewporter_state(&mut self) -> &mut ViewporterState { &mut self.viewporter_state }
}

impl FractionalScaleHandler for BlueState {
    fn fractional_scale_state(&mut self) -> &mut FractionalScaleState { &mut self.fractional_scale_state }
}

impl ShmHandler for BlueState {
    fn shm_state(&self) -> &ShmState { &self.shm_state }
}

impl OutputHandler for BlueState {}

impl SeatHandler for BlueState {
    type KeyboardFocus = Window;
    type PointerFocus = Window;
    type TouchFocus = Window;
    fn seat_state(&mut self) -> &mut SeatState<Self> { &mut self.seat_state }
    fn cursor_image(&mut self, image: CursorImageStatus) {
        *self.cursor_status.lock().unwrap() = image;
    }
}

impl DataDeviceHandler for BlueState {
    fn data_device_state(&mut self) -> &mut DataDeviceState { &mut self.data_device_state }
}

impl BufferHandler for BlueState {
    fn buffer_destroyed(&mut self, _buffer: &WlBuffer) {
        // Cleanup if needed
    }
}

pub fn run_compositor() -> anyhow::Result<()> {
    let mut event_loop = EventLoop::<BlueState>::try_new()?;
    let loop_handle = event_loop.handle();
    let mut display = Display::<BlueState>::new()?;
    let dh = display.handle();
    let mut state = BlueState::new(dh, loop_handle.clone());
    let socket_source = ListeningSocketSource::new_auto()?;
    let socket_name = socket_source.socket_name().to_os_string().into_string().unwrap();
    loop_handle.insert_source(socket_source, |client, _, state| {
        state.display_handle.insert_client(client, Arc::new(ClientState::default())).unwrap();
    })?;
    loop_handle.insert_source(
        Generic::new(display.backend().poll_fd(), Interest::Read, Mode::Level),
                              |_, _, state| {
                                  unsafe {
                                      display.dispatch_clients(state)?;
                                  }
                                  display.flush_clients()?;
                                  Ok(PostAction::Continue)
                              },
    )?;
    std::env::set_var("WAYLAND_DISPLAY", &socket_name);
    println!("WAYLAND_DISPLAY={}", socket_name);

    // Init winit backend
    let (mut backend, input_backend) = winit::init::<GlesRenderer>(&state.display_handle)?;
    let size = backend.window_size().physical_size;
    let mode = DisplayMode {
        size: (size.width as i32, size.height as i32).into(),
        refresh: 60_000,
    };
    state.output.change_current_state(Some(mode), Some(Transform::Normal), Some(OutputScale::Integer(1)), Some((0,0).into()));
    state.space.map_output(&state.output, (0,0));
    state.winit_backend = Some(backend);

    loop_handle.insert_source(input_backend, |event, _, state| {
        match event {
            WinitEvent::Resized { size, .. } => {
                let physical = size.physical_size;
                let mode = DisplayMode {
                    size: (physical.width as i32, physical.height as i32).into(),
                              refresh: 60_000,
                };
                state.output.change_current_state(Some(mode), None, None, None);
                state.space.refresh();
                state.damage_tracker = OutputDamageTracker::new(physical.into(), 1.0, Transform::Normal);
                state.winit_backend.as_ref().unwrap().window().request_redraw();
            }
            WinitEvent::Input(input_event) => state.process_input_event(input_event),
                              WinitEvent::RedrawRequested => {
                                  state.render().ok();
                              }
                              _ => {}
        }
    })?;

    // XWayland
    state.xwayland.start(&mut display, &loop_handle, state.output.clone(), |event, state| {
        match event {
            XWaylandEvent::Ready { connection, client, .. } => {
                state.display_handle.insert_client(client, Arc::new(ClientState::default())).unwrap();
                // Handle connection
            }
            XWaylandEvent::Exited => {
                // Handle
            }
        }
    })?;

    event_loop.run(None, &mut state, |_| {})?;
    Ok(())
}
