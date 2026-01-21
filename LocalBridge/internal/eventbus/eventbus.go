package eventbus

import (
	"sync"
)

// Event 事件结构
type Event struct {
	Type string      // 事件类型
	Data interface{} // 事件数据
}

// 事件处理函数类型
type EventHandler func(event Event)

// 事件总线
type EventBus struct {
	handlers map[string][]EventHandler
	mu       sync.RWMutex
}

// 创建新的事件总线
func New() *EventBus {
	return &EventBus{
		handlers: make(map[string][]EventHandler),
	}
}

// 订阅事件
func (eb *EventBus) Subscribe(eventType string, handler EventHandler) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.handlers[eventType] = append(eb.handlers[eventType], handler)
}

// 同步发布事件
func (eb *EventBus) Publish(eventType string, data interface{}) {
	eb.mu.RLock()
	handlers := eb.handlers[eventType]
	eb.mu.RUnlock()

	event := Event{
		Type: eventType,
		Data: data,
	}

	for _, handler := range handlers {
		handler(event)
	}
}

// 异步发布事件
func (eb *EventBus) PublishAsync(eventType string, data interface{}) {
	go eb.Publish(eventType, data)
}

// 取消订阅
func (eb *EventBus) Unsubscribe(eventType string) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	delete(eb.handlers, eventType)
}

// 全局事件总线实例
var globalBus = New()

// 获取全局事件总线
func GetGlobalBus() *EventBus {
	return globalBus
}

// 事件类型常量
const (
	EventFileScanCompleted     = "file.scan.completed"
	EventFileChanged           = "file.changed"
	EventConnectionEstablished = "connection.established"
	EventConnectionClosed      = "connection.closed"
	EventResourceScanCompleted = "resource.scan.completed"
	EventConfigReload          = "config.reload"
)
