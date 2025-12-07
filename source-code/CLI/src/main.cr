require "process"
require "file_utils"

def check_environment
  if ENV["DISPLAY"]? || ENV["WAYLAND_DISPLAY"]?
    puts "Cannot start Blue Environment while in another graphical session."
    exit 1
  end
end

def setup_directories
  home = ENV["HOME"]? || "~"
  dir = "#{home}/.hackeros/Blue-Enviroment"
  unless Dir.exists?(dir)
    puts "Blue Environment binaries directory not found: #{dir}"
    puts "Please ensure the binaries are installed correctly."
    exit 1
  end
  dir
end

def start_process(command : String)
  spawn do
    status = Process.run(command, shell: true, output: Process::Redirect::Inherit, error: Process::Redirect::Inherit)
    if !status.success?
      puts "Failed to start #{command}: exit code #{status.exit_code}"
    end
  end
end

def main
  check_environment
  bin_dir = setup_directories

  # Apply decorations/themes first
  start_process("#{bin_dir}/decorations")

  # Start core compositor
  start_process("#{bin_dir}/core")

  # Give time for compositor to initialize
  sleep 2.seconds

  # Assume socket is wayland-0
  ENV["WAYLAND_DISPLAY"] = "wayland-0"
  ENV["XDG_RUNTIME_DIR"] ||= "/run/user/#{Process.uid}"

  # Start XWayland if not handled by core
  # Assuming core handles it, but if needed:
  # start_process("XWayland :0 -rootless -terminate")

  # Start WM
  start_process("#{bin_dir}/wm")

  # Start shell (panel)
  start_process("#{bin_dir}/shell")

  # Start desktop (background and icons)
  start_process("#{bin_dir}/desktop")

  # The launcher is started on demand via shortcuts or menu

  # Keep the launcher process alive, wait for children
  channel = Channel(Nil).new
  Signal::INT.trap { channel.send(nil) }
  Signal::TERM.trap { channel.send(nil) }
  channel.receive
  puts "Shutting down Blue Environment..."
  # TODO: Properly terminate child processes if needed
end

main
