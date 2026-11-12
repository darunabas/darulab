# Local-preview shim (load with RUBYOPT, see README "Local preview"): Jekyll 3.9.2's Stevenson logger skips Logger#initialize,
# which newer logger gems (Ruby 3.3) rely on for @level_override.
require "logger"
module LoggerLevelOverrideFix
  def level
    @level_override ||= {}
    super
  end
end
Logger.prepend(LoggerLevelOverrideFix)

# Liquid 4.0.3 still calls Object#tainted?/taint/untaint, removed in Ruby 3.2.
class Object
  def tainted?; false; end unless method_defined?(:tainted?)
  def taint; self; end unless method_defined?(:taint)
  def untaint; self; end unless method_defined?(:untaint)
end
