package maa

import (
	"errors"
	"unsafe"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

var (
	inited bool

	ErrSetLogDir              = errors.New("failed to set log directory")
	ErrSetSaveDraw            = errors.New("failed to set save draw option")
	ErrSetStdoutLevel         = errors.New("failed to set stdout level")
	ErrSetDebugMode           = errors.New("failed to set debug mode")
	ErrSetSaveOnError         = errors.New("failed to set save on error option")
	ErrSetDrawQuality         = errors.New("failed to set draw quality")
	ErrSetRecoImageCacheLimit = errors.New("failed to set recognition image cache limit")
	ErrLoadPlugin             = errors.New("failed to load plugin")
	ErrEmptyLogDir            = errors.New("log directory path is empty")
)

// LibraryLoadError represents an error that occurs when loading a MAA dynamic library.
// This error type provides detailed information about which library failed to load,
// including the library name, the full path attempted, and the underlying system error.
type LibraryLoadError = native.LibraryLoadError

// initConfig contains configuration options for initializing the MAA framework.
// It specifies various settings that control the framework's behavior,
// logging, debugging, and resource locations.
type initConfig struct {
	// LibDir specifies the directory path where MAA dynamic libraries are located.
	// If empty, the framework will attempt to locate libraries in default paths.
	LibDir string

	// LogDir specifies the directory where log files will be written.
	// Nil means Init will not set this option.
	LogDir *string

	// SaveDraw controls whether to save recognition results to LogDir/vision.
	// When enabled, RecoDetail will be able to retrieve draws for debugging purposes.
	// Nil means Init will not set this option.
	SaveDraw *bool

	// StdoutLevel sets the logging verbosity level for standard output.
	// Controls which log messages are displayed on the console.
	// Nil means Init will not set this option.
	StdoutLevel *LoggingLevel

	// DebugMode enables or disables comprehensive debug mode.
	// When enabled, additional debug information is collected and logged.
	// Nil means Init will not set this option.
	DebugMode *bool

	// PluginPaths specifies the paths to the plugins to load.
	// Nil means Init will not process plugin loading.
	PluginPaths *[]string

	// JSONEncoder sets a custom JSON encoder for the framework.
	// Nil means Init will not change the current encoder.
	JSONEncoder JSONEncoder

	// JSONDecoder sets a custom JSON decoder for the framework.
	// Nil means Init will not change the current decoder.
	JSONDecoder JSONDecoder
}

// InitOption defines a function type for configuring initialization through functional options.
// Use package-provided WithXxx helpers to construct options.
type InitOption func(*initConfig)

// WithLibDir returns an InitOption that sets the library directory path for the MAA framework.
// The libDir parameter specifies the directory where the MAA dynamic library is located.
func WithLibDir(libDir string) InitOption {
	return func(ic *initConfig) {
		ic.LibDir = libDir
	}
}

// WithLogDir returns an InitOption that sets the directory path for log files.
// The logDir parameter specifies where the MAA framework should write its log files.
func WithLogDir(logDir string) InitOption {
	return func(ic *initConfig) {
		ic.LogDir = &logDir
	}
}

// WithSaveDraw returns an InitOption that configures whether to save drawing information.
// When enabled is true, recognition results will be saved to LogDir/vision directory
// and RecoDetail will be able to retrieve draws for debugging.
func WithSaveDraw(enabled bool) InitOption {
	return func(ic *initConfig) {
		ic.SaveDraw = &enabled
	}
}

// WithStdoutLevel returns an InitOption that sets the logging level for standard output.
// The level parameter determines the verbosity of logs written to stdout.
func WithStdoutLevel(level LoggingLevel) InitOption {
	return func(ic *initConfig) {
		ic.StdoutLevel = &level
	}
}

// WithDebugMode returns an InitOption that enables or disables debug mode.
// When enabled is true, additional debug information will be collected and logged.
func WithDebugMode(enabled bool) InitOption {
	return func(ic *initConfig) {
		ic.DebugMode = &enabled
	}
}

func WithPluginPaths(path ...string) InitOption {
	return func(ic *initConfig) {
		pluginPaths := append([]string(nil), path...)
		ic.PluginPaths = &pluginPaths
	}
}

// WithJSONEncoder returns an InitOption that sets a custom JSON encoder.
func WithJSONEncoder(encoder JSONEncoder) InitOption {
	if encoder == nil {
		panic("json encoder cannot be nil")
	}
	return func(ic *initConfig) {
		ic.JSONEncoder = encoder
	}
}

// WithJSONDecoder returns an InitOption that sets a custom JSON decoder.
func WithJSONDecoder(decoder JSONDecoder) InitOption {
	if decoder == nil {
		panic("json decoder cannot be nil")
	}
	return func(ic *initConfig) {
		ic.JSONDecoder = decoder
	}
}

// Init loads the dynamic library related to the MAA framework and registers its related functions.
// It must be called before invoking any other MAA-related functions.
// It must not be called concurrently with Release or other MAA-related functions.
// Note: If this function is not called before other MAA functions, it will trigger a null pointer panic.
func Init(opts ...InitOption) error {

	if inited {
		return nil
	}

	cfg := initConfig{}

	for _, opt := range opts {
		opt(&cfg)
	}

	if err := native.Initialize(cfg.LibDir); err != nil {
		return err
	}

	success := false
	defer func() {
		if !success {
			_ = native.Shutdown()
		}
	}()

	if cfg.LogDir != nil {
		if err := SetLogDir(*cfg.LogDir); err != nil {
			return err
		}
	}
	if cfg.SaveDraw != nil {
		if err := SetSaveDraw(*cfg.SaveDraw); err != nil {
			return err
		}
	}
	if cfg.StdoutLevel != nil {
		if err := SetStdoutLevel(*cfg.StdoutLevel); err != nil {
			return err
		}
	}
	if cfg.DebugMode != nil {
		if err := SetDebugMode(*cfg.DebugMode); err != nil {
			return err
		}
	}

	if cfg.PluginPaths != nil {
		for _, path := range *cfg.PluginPaths {
			if err := LoadPlugin(path); err != nil {
				return err
			}
		}
	}

	if cfg.JSONEncoder != nil {
		SetJSONEncoder(cfg.JSONEncoder)
	}
	if cfg.JSONDecoder != nil {
		SetJSONDecoder(cfg.JSONDecoder)
	}

	inited = true
	success = true

	return nil
}

// IsInited checks if the MAA framework has been initialized.
// It must not be called concurrently with Init or Release.
func IsInited() bool {
	return inited
}

// Release releases the dynamic library resources of the MAA framework and unregisters its related functions.
// It must not be called concurrently with Init or other MAA-related functions.
func Release() error {

	if err := native.Shutdown(); err != nil {
		return err
	}

	inited = false

	return nil
}

func setGlobalOption(key native.MaaGlobalOption, value unsafe.Pointer, valSize uintptr) bool {
	return native.MaaGlobalSetOption(key, value, uint64(valSize))
}

// SetLogDir sets the log directory.
func SetLogDir(path string) error {
	if path == "" {
		return ErrEmptyLogDir
	}
	if !setGlobalOption(native.MaaGlobalOption_LogDir, unsafe.Pointer(&[]byte(path)[0]), uintptr(len(path))) {
		return ErrSetLogDir
	}
	return nil
}

// SetSaveDraw sets whether to save draw.
func SetSaveDraw(enabled bool) error {
	if !setGlobalOption(native.MaaGlobalOption_SaveDraw, unsafe.Pointer(&enabled), unsafe.Sizeof(enabled)) {
		return ErrSetSaveDraw
	}
	return nil
}

type LoggingLevel int32

// LoggingLevel
const (
	LoggingLevelOff LoggingLevel = iota
	LoggingLevelFatal
	LoggingLevelError
	LoggingLevelWarn
	LoggingLevelInfo
	LoggingLevelDebug
	LoggingLevelTrace
	LoggingLevelAll
)

// SetStdoutLevel sets the level of log output to stdout.
func SetStdoutLevel(level LoggingLevel) error {
	if !setGlobalOption(native.MaaGlobalOption_StdoutLevel, unsafe.Pointer(&level), unsafe.Sizeof(level)) {
		return ErrSetStdoutLevel
	}
	return nil
}

// SetDebugMode sets whether to enable debug mode.
func SetDebugMode(enabled bool) error {
	if !setGlobalOption(native.MaaGlobalOption_DebugMode, unsafe.Pointer(&enabled), unsafe.Sizeof(enabled)) {
		return ErrSetDebugMode
	}
	return nil
}

// SetSaveOnError sets whether to save screenshot on error.
func SetSaveOnError(enabled bool) error {
	if !setGlobalOption(native.MaaGlobalOption_SaveOnError, unsafe.Pointer(&enabled), unsafe.Sizeof(enabled)) {
		return ErrSetSaveOnError
	}
	return nil
}

// SetDrawQuality sets image quality for draw images.
// Default value is 85, range: [0, 100].
func SetDrawQuality(quality int32) error {
	if !setGlobalOption(native.MaaGlobalOption_DrawQuality, unsafe.Pointer(&quality), unsafe.Sizeof(quality)) {
		return ErrSetDrawQuality
	}
	return nil
}

// SetRecoImageCacheLimit sets recognition image cache limit.
// Default value is 4096.
func SetRecoImageCacheLimit(limit uint64) error {
	if !setGlobalOption(native.MaaGlobalOption_RecoImageCacheLimit, unsafe.Pointer(&limit), unsafe.Sizeof(limit)) {
		return ErrSetRecoImageCacheLimit
	}
	return nil
}

// LoadPlugin loads a plugin specified by path.
// The path may be a full filesystem path or just a plugin name.
// When only a name is provided, the function searches system directories and the current working directory for a matching plugin.
// If the path refers to a directory, plugins inside that directory are searched recursively.
func LoadPlugin(path string) error {
	if !native.MaaGlobalLoadPlugin(path) {
		return ErrLoadPlugin
	}
	return nil
}
