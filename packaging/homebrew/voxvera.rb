class Voxvera < Formula
  desc "Generate QR-coded flyers"
  homepage "https://github.com/PR0M3TH3AN/VoxVera"
  url "https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
  version "0.1.0"
  sha256 "<insert-sha256>"

  def install
    bin.install "voxvera"
  end

  test do
    system "#{bin}/voxvera", "--help"
  end
end
