project('blue-backend', 'c',
  version: '0.3.0',
  default_options: ['c_std=c11', 'warning_level=2'],
)

# Fix: Define WLR_USE_UNSTABLE to allow compiling against wlroots
add_project_arguments('-DWLR_USE_UNSTABLE', language: 'c')

cc = meson.get_compiler('c')

wlroots = dependency('wlroots', version: ['>=0.16.0', '<0.19.0'])
wayland_server = dependency('wayland-server')
wayland_protos = dependency('wayland-protocols')
xkbcommon = dependency('xkbcommon')
math = cc.find_library('m')

# --- Protocol Generation (Fix for xdg-shell-protocol.h missing) ---

# Find wayland-scanner program
wayland_scanner_dep = dependency('wayland-scanner', native: true)
wayland_scanner = find_program(
  wayland_scanner_dep.get_variable(pkgconfig: 'wayland_scanner')
)

# Find protocols directory
protocols_dep = dependency('wayland-protocols')
protocols_dir = protocols_dep.get_variable(pkgconfig: 'pkgdatadir')

# Define protocols to generate
protocols = [
  {'name': 'xdg-shell', 'path': 'stable/xdg-shell/xdg-shell.xml'},
]

generated_protocols = []

foreach p : protocols
  xml = join_paths(protocols_dir, p['path'])

  # Generate Header (.h)
  generated_protocols += custom_target(
    '@0@ client header'.format(p['name']),
    input: xml,
    output: '@0@-protocol.h'.format(p['name']),
    command: [wayland_scanner, 'server-header', '@INPUT@', '@OUTPUT@'],
  )

  # Generate Source (.c)
  generated_protocols += custom_target(
    '@0@ source'.format(p['name']),
    input: xml,
    output: '@0@-protocol.c'.format(p['name']),
    command: [wayland_scanner, 'private-code', '@INPUT@', '@OUTPUT@'],
  )
endforeach

src_files = [
  'main.c',
]

executable('blue-compositor',
  src_files + generated_protocols,
  dependencies: [wlroots, wayland_server, wayland_protos, xkbcommon, math],
  install: true,
)
