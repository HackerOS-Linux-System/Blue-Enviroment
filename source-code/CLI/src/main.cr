require "process"
require "file_utils"
require "http/client"

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

def start_environment(bin_dir : String)
  check_environment
  # Apply decorations/themes first
  start_process("#{bin_dir}/decorations")
  # Start core compositor
  start_process("#{bin_dir}/core")
  # Give time for compositor to initialize
  sleep 2.seconds
  # Assume socket is wayland-0
  ENV["WAYLAND_DISPLAY"] = "wayland-0"
  ENV["XDG_RUNTIME_DIR"] ||= "/run/user/#{LibC.getuid}"
  # Start XWayland if not handled by core
  # Assuming core handles it, but if needed:
  # start_process("XWayland :0 -rootless -terminate")
  # Start WM
  start_process("#{bin_dir}/wm")
  # Start shell (panel)
  start_process("#{bin_dir}/shell")
  # Start desktop (background and icons)
  start_process("#{bin_dir}/Desktop")
  # The launcher is started on demand via shortcuts or menu
  # Keep the launcher process alive, wait for children
  channel = Channel(Nil).new
  Signal::INT.trap { channel.send(nil) }
  Signal::TERM.trap { channel.send(nil) }
  channel.receive
  puts "Shutting down Blue Environment..."
  # TODO: Properly terminate child processes if needed
end

def show_help
  puts "Blue-Environment Commands:"
  puts "  (no subcommand) - Start the Blue Environment graphical session."
  puts "  help - Show this full list of commands."
  puts "  update - Update the Blue Environment to the latest version."
end

def get_version_from_file(path : String) : Float64
  content = File.read(path).strip.gsub(/[\[\]\s]/, "")
  content.to_f
rescue
  puts "Error reading version file: #{path}"
  exit 1
end

def get_remote_version : Float64
  url = "https://raw.githubusercontent.com/HackerOS-Linux-System/Blue-Enviroment/main/config/version.hacker"
  response = HTTP::Client.get(url)
  if response.success?
    response.body.strip.gsub(/[\[\]\s]/, "").to_f
  else
    puts "Failed to fetch remote version: #{response.status_code}"
    exit 1
  end
end

def download_file(url : String, dest : String)
  response = HTTP::Client.get(url)
  if response.success?
    File.write(dest, response.body)
    File.chmod(dest, 0o755)
  else
    puts "Failed to download #{url}: #{response.status_code}"
    exit 1
  end
end

def perform_update(bin_dir : String)
  home = ENV["HOME"]? || "~"
  local_version_path = "#{bin_dir}/version.hacker"
  local_version = get_version_from_file(local_version_path)
  remote_version = get_remote_version

  if remote_version > local_version
    puts "New version available: #{remote_version}. Updating..."

    # Download new version file
    version_url = "https://raw.githubusercontent.com/HackerOS-Linux-System/Blue-Enviroment/main/config/version.hacker"
    download_file(version_url, local_version_path)

    # List of binaries to update in bin_dir
    binaries = ["wm", "core", "Desktop", "launcher", "decorations", "shell"]

    # Remove old binaries
    binaries.each do |bin|
      File.delete("#{bin_dir}/#{bin}") rescue nil
    end
    File.delete("/usr/bin/Blue-Environment") rescue nil

    # Download new binaries
    base_url = "https://github.com/HackerOS-Linux-System/Blue-Enviroment/releases/download/v#{remote_version}"
    binaries.each do |bin|
      download_file("#{base_url}/#{bin}", "#{bin_dir}/#{bin}")
    end
    download_file("#{base_url}/Blue-Environment", "/usr/bin/Blue-Environment")

    puts "Update completed successfully."
  else
    puts "Blue Environment is already up to date (version #{local_version})."
  end
end

def main
  bin_dir = setup_directories

  if ARGV.empty?
    start_environment(bin_dir)
  elsif ARGV.size > 0
    case ARGV[0]
    when "help"
      show_help
    when "update"
      perform_update(bin_dir)
    else
      puts "Unknown subcommand: #{ARGV[0]}"
      show_help
    end
  end
end

main
