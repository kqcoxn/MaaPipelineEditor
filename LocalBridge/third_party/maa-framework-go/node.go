package maa

import (
	"maps"
	"slices"
	"time"
)

// Node represents a single task node in the pipeline.
type Node struct {
	Name string `json:"-"`

	// Anchor maps anchor name to target node name. This matches GetNodeData output format.
	Anchor map[string]string `json:"anchor,omitempty"`

	// Recognition defines how this node recognizes targets on screen.
	Recognition *Recognition `json:"recognition,omitempty"`
	// Action defines what action to perform when recognition succeeds.
	Action *Action `json:"action,omitempty"`
	// Next specifies the list of possible next nodes to execute.
	Next []NextItem `json:"next,omitempty"`
	// RateLimit sets the minimum interval between recognition attempts in milliseconds. Default: 1000.
	RateLimit *int64 `json:"rate_limit,omitempty"`
	// Timeout sets the maximum time to wait for recognition in milliseconds. Default: 20000.
	Timeout *int64 `json:"timeout,omitempty"`
	// OnError specifies nodes to execute when recognition times out or action execution fails.
	OnError []NextItem `json:"on_error,omitempty"`
	// Inverse inverts the recognition result. Default: false.
	Inverse bool `json:"inverse,omitempty"`
	// Enabled determines whether this node is active. Default: true.
	Enabled *bool `json:"enabled,omitempty"`
	// MaxHit sets the maximum hit count of the node. Default: unlimited.
	MaxHit *uint64 `json:"max_hit,omitempty"`
	// PreDelay sets the delay before action execution in milliseconds. Default: 200.
	PreDelay *int64 `json:"pre_delay,omitempty"`
	// PostDelay sets the delay after action execution in milliseconds. Default: 200.
	PostDelay *int64 `json:"post_delay,omitempty"`
	// PreWaitFreezes waits for screen to stabilize before action execution.
	PreWaitFreezes *WaitFreezesParam `json:"pre_wait_freezes,omitempty"`
	// PostWaitFreezes waits for screen to stabilize after action.
	PostWaitFreezes *WaitFreezesParam `json:"post_wait_freezes,omitempty"`
	// Repeat specifies the number of times to repeat the node. Default: 1.
	Repeat *uint64 `json:"repeat,omitempty"`
	// RepeatDelay sets the delay between repetitions in milliseconds. Default: 0.
	RepeatDelay *int64 `json:"repeat_delay,omitempty"`
	// RepeatWaitFreezes waits for screen to stabilize between repetitions.
	RepeatWaitFreezes *WaitFreezesParam `json:"repeat_wait_freezes,omitempty"`
	// Focus specifies custom focus data.
	Focus any `json:"focus,omitempty"`
	// Attach provides additional custom data for the node.
	Attach map[string]any `json:"attach,omitempty"`
}

// NewNode creates a new Node with the given name.
func NewNode(name string) *Node {
	return &Node{
		Name:   name,
		Attach: make(map[string]any),
	}
}

// SetAnchor sets the anchor for the node and returns the node for chaining.
func (n *Node) SetAnchor(anchor map[string]string) *Node {
	n.Anchor = maps.Clone(anchor)
	return n
}

// SetAnchorTarget sets an anchor to a specific target node and returns the node for chaining.
func (n *Node) SetAnchorTarget(anchor, nodeName string) *Node {
	if anchor == "" {
		return n
	}
	if n.Anchor == nil {
		n.Anchor = make(map[string]string)
	}
	n.Anchor[anchor] = nodeName
	return n
}

// SetRecognition sets the recognition for the node and returns the node for chaining.
func (n *Node) SetRecognition(rec *Recognition) *Node {
	n.Recognition = rec
	return n
}

// SetAction sets the action for the node and returns the node for chaining.
func (n *Node) SetAction(act *Action) *Node {
	n.Action = act
	return n
}

// SetNext sets the next nodes list for the node and returns the node for chaining.
func (n *Node) SetNext(next []NextItem) *Node {
	n.Next = slices.Clone(next)
	return n
}

// SetRateLimit sets the rate limit for the node and returns the node for chaining.
func (n *Node) SetRateLimit(rateLimit time.Duration) *Node {
	d := rateLimit.Milliseconds()
	n.RateLimit = &d
	return n
}

// SetTimeout sets the timeout for the node and returns the node for chaining.
func (n *Node) SetTimeout(timeout time.Duration) *Node {
	d := timeout.Milliseconds()
	n.Timeout = &d
	return n
}

// SetOnError sets the error handling nodes for the node and returns the node for chaining.
func (n *Node) SetOnError(onError []NextItem) *Node {
	n.OnError = slices.Clone(onError)
	return n
}

// SetInverse sets whether to invert the recognition result and returns the node for chaining.
func (n *Node) SetInverse(inverse bool) *Node {
	n.Inverse = inverse
	return n
}

// SetEnabled sets whether the node is enabled and returns the node for chaining.
func (n *Node) SetEnabled(enabled bool) *Node {
	n.Enabled = &enabled
	return n
}

// SetMaxHit sets the maximum hit count of the node and returns the node for chaining.
func (n *Node) SetMaxHit(maxHit uint64) *Node {
	n.MaxHit = &maxHit
	return n
}

// SetPreDelay sets the delay before action execution and returns the node for chaining.
func (n *Node) SetPreDelay(preDelay time.Duration) *Node {
	d := preDelay.Milliseconds()
	n.PreDelay = &d
	return n
}

// SetPostDelay sets the delay after action execution and returns the node for chaining.
func (n *Node) SetPostDelay(postDelay time.Duration) *Node {
	d := postDelay.Milliseconds()
	n.PostDelay = &d
	return n
}

// SetPreWaitFreezes sets the pre-action wait freezes configuration and returns the node for chaining.
func (n *Node) SetPreWaitFreezes(preWaitFreezes *WaitFreezesParam) *Node {
	n.PreWaitFreezes = preWaitFreezes
	return n
}

// SetPostWaitFreezes sets the post-action wait freezes configuration and returns the node for chaining.
func (n *Node) SetPostWaitFreezes(postWaitFreezes *WaitFreezesParam) *Node {
	n.PostWaitFreezes = postWaitFreezes
	return n
}

// SetRepeat sets the number of times to repeat the node and returns the node for chaining.
func (n *Node) SetRepeat(repeat uint64) *Node {
	n.Repeat = &repeat
	return n
}

// SetRepeatDelay sets the delay between repetitions and returns the node for chaining.
func (n *Node) SetRepeatDelay(repeatDelay time.Duration) *Node {
	d := repeatDelay.Milliseconds()
	n.RepeatDelay = &d
	return n
}

// SetRepeatWaitFreezes sets the wait freezes configuration between repetitions and returns the node for chaining.
func (n *Node) SetRepeatWaitFreezes(repeatWaitFreezes *WaitFreezesParam) *Node {
	n.RepeatWaitFreezes = repeatWaitFreezes
	return n
}

// SetFocus sets the focus data for the node and returns the node for chaining.
func (n *Node) SetFocus(focus any) *Node {
	n.Focus = focus
	return n
}

// SetAttach sets the attached custom data for the node and returns the node for chaining.
// The map is copied so the node does not share state with the caller.
// A nil attach is stored as an empty map so that Attach is never nil.
func (n *Node) SetAttach(attach map[string]any) *Node {
	if attach == nil {
		n.Attach = make(map[string]any)
	} else {
		n.Attach = maps.Clone(attach)
	}
	return n
}

// NextItem is one item in the list of nodes to run next.
// It is used in Node.Next (on success) and Node.OnError (on failure).
type NextItem struct {
	// Name is the name of the target node.
	Name string `json:"name"`
	// JumpBack indicates whether to jump back to the parent node after this node's chain completes.
	JumpBack bool `json:"jump_back"`
	// Anchor indicates whether this node should be set as the anchor.
	Anchor bool `json:"anchor"`
}

// FormatName returns the name with attribute prefixes, e.g. [JumpBack]NodeA.
func (i NextItem) FormatName() string {
	name := i.Name
	if i.JumpBack {
		name = "[JumpBack]" + name
	}
	if i.Anchor {
		name = "[Anchor]" + name
	}
	return name
}

// NodeAttributeOption is a functional option for configuring NextItem attributes.
type NodeAttributeOption func(*NextItem)

// WithJumpBack enables the jump-back mechanism. When this node matches, the system returns
// to the parent node after completing this node's chain, and continues recognizing from the start of next list.
func WithJumpBack() NodeAttributeOption {
	return func(i *NextItem) {
		i.JumpBack = true
	}
}

// WithAnchor enables anchor reference. The name field will be treated as an anchor name
// and resolved to the last node that set this anchor at runtime.
func WithAnchor() NodeAttributeOption {
	return func(i *NextItem) {
		i.Anchor = true
	}
}

// AddAnchor sets an anchor to the current node and returns the node for chaining.
func (n *Node) AddAnchor(anchor string) *Node {
	return n.SetAnchorTarget(anchor, n.Name)
}

// ClearAnchor marks an anchor as cleared and returns the node for chaining.
func (n *Node) ClearAnchor(anchor string) *Node {
	return n.SetAnchorTarget(anchor, "")
}

// RemoveAnchor removes an anchor from the node and returns the node for chaining.
func (n *Node) RemoveAnchor(anchor string) *Node {
	if anchor == "" {
		return n
	}

	delete(n.Anchor, anchor)

	return n
}

// AddNext appends a node to the next list and returns the node for chaining.
func (n *Node) AddNext(name string, opts ...NodeAttributeOption) *Node {
	if name == "" {
		return n
	}

	newItem := NextItem{
		Name: name,
	}
	for _, opt := range opts {
		opt(&newItem)
	}

	found := false
	for i, item := range n.Next {
		if item.Name == name {
			n.Next[i] = newItem
			found = true
			break
		}
	}

	if !found {
		n.Next = append(n.Next, newItem)
	}
	return n
}

// RemoveNext removes a node from the next list and returns the node for chaining.
func (n *Node) RemoveNext(name string) *Node {
	if name == "" {
		return n
	}

	n.Next = slices.DeleteFunc(n.Next, func(item NextItem) bool {
		return item.Name == name
	})

	return n
}

// AddOnError appends a node to the on_error list and returns the node for chaining.
func (n *Node) AddOnError(name string, opts ...NodeAttributeOption) *Node {
	if name == "" {
		return n
	}

	newItem := NextItem{
		Name: name,
	}
	for _, opt := range opts {
		opt(&newItem)
	}

	found := false
	for i, item := range n.OnError {
		if item.Name == name {
			n.OnError[i] = newItem
			found = true
			break
		}
	}

	if !found {
		n.OnError = append(n.OnError, newItem)
	}
	return n
}

// RemoveOnError removes a node from the on_error list and returns the node for chaining.
func (n *Node) RemoveOnError(name string) *Node {
	if name == "" {
		return n
	}

	n.OnError = slices.DeleteFunc(n.OnError, func(item NextItem) bool {
		return item.Name == name
	})

	return n
}
