package jsoncodec

import (
	"encoding/json"
	"sync/atomic"
)

type Encoder func(v any) ([]byte, error)
type Decoder func(data []byte, v any) error

var (
	defaultEncoder Encoder = json.Marshal
	defaultDecoder Decoder = json.Unmarshal

	encoderStore atomic.Value
	decoderStore atomic.Value
)

func init() {
	encoderStore.Store(defaultEncoder)
	decoderStore.Store(defaultDecoder)
}

func SetEncoder(encoder Encoder) {
	if encoder == nil {
		panic("json encoder cannot be nil")
	}
	encoderStore.Store(encoder)
}

func SetDecoder(decoder Decoder) {
	if decoder == nil {
		panic("json decoder cannot be nil")
	}
	decoderStore.Store(decoder)
}

func GetEncoder() Encoder {
	return encoderStore.Load().(Encoder)
}

func GetDecoder() Decoder {
	return decoderStore.Load().(Decoder)
}

func Reset() {
	encoderStore.Store(defaultEncoder)
	decoderStore.Store(defaultDecoder)
}

func Marshal(v any) ([]byte, error) {
	return GetEncoder()(v)
}

func Unmarshal(data []byte, v any) error {
	return GetDecoder()(data, v)
}
