require "option_parser"

module BlueEnvironment
  VERSION = "0.1.0"

  def self.run_backend_and_frontend
    user = ENV["USER"]? || "unknown"
    base_path = "/home/#{user}/.hackeros/Blue-Environment"

    # Kolory ANSI
    red = "\e[31m"
    green = "\e[32m"
    yellow = "\e[33m"
    blue = "\e[34m"
    reset = "\e[0m"

    puts "#{blue}Uruchamianie Blue-Environment...#{reset}"

    # Uruchom blue-backend
    puts "#{yellow}Uruchamianie backendu...#{reset}"
    backend_path = "#{base_path}/blue-backend"
    begin
      Process.run(backend_path, shell: true)
      puts "#{green}Backend uruchomiony pomyślnie.#{reset}"
    rescue ex
      puts "#{red}Błąd podczas uruchamiania backendu: #{ex.message}#{reset}"
      exit(1)
    end

    # Uruchom blue-frontend
    puts "#{yellow}Uruchamianie frontendu...#{reset}"
    frontend_path = "#{base_path}/blue-frontend"
    begin
      Process.run(frontend_path, shell: true)
      puts "#{green}Frontend uruchomiony pomyślnie.#{reset}"
    rescue ex
      puts "#{red}Błąd podczas uruchamiania frontendu: #{ex.message}#{reset}"
      exit(1)
    end

    puts "#{blue}Blue-Environment zakończone.#{reset}"
  end

  def self.show_help
    # Kolory ANSI
    cyan = "\e[36m"
    reset = "\e[0m"

    puts "#{cyan}Blue-Environment - Narzędzie do zarządzania środowiskiem Blue.#{reset}"
    puts "Użycie: blue-environment [komenda]"
    puts ""
    puts "Dostępne komendy:"
    puts "  help     - Pokazuje tę listę komend"
    puts "  update   - Placeholder na przyszłą aktualizację (obecnie nic nie robi)"
    puts ""
    puts "Bez komendy: Uruchamia blue-backend i blue-frontend."
  end

  def self.update
    # Kolory ANSI
    magenta = "\e[35m"
    reset = "\e[0m"

    puts "#{magenta}Update: Placeholder - W przyszłości rozbudujemy tę funkcję.#{reset}"
  end
end

# Parsowanie opcji
command = ARGV.shift? || ""

case command
when "help"
  BlueEnvironment.show_help
when "update"
  BlueEnvironment.update
else
  if command != ""
    puts "\e[31mNieznana komenda: #{command}\e[0m"
    BlueEnvironment.show_help
    exit(1)
  end
  BlueEnvironment.run_backend_and_frontend
end
