// Package maa provides Go bindings for the MaaFramework.
// For pipeline protocol details, see:
// https://github.com/MaaXYZ/MaaFramework/blob/main/docs/en_us/3.1-PipelineProtocol.md

package maa

// Node is a single unit of work in a pipeline.
//
// Task is a logical sequential structure consisting of several Nodes connected in a specific order,
// representing the entire process from start to finish.
//
// Entry is the first node in a task.
//
// Pipeline is a collection of all nodes.

// Pipeline represents a collection of nodes that define a task flow.
type Pipeline struct {
	nodes map[string]*Node
}

// NewPipeline creates a new empty Pipeline.
func NewPipeline() *Pipeline {
	return &Pipeline{
		nodes: make(map[string]*Node),
	}
}

// MarshalJSON implements the json.Marshaler interface.
func (p *Pipeline) MarshalJSON() ([]byte, error) {
	return marshalJSON(p.nodes)
}

// AddNode adds a node to the pipeline and returns the pipeline for chaining.
func (p *Pipeline) AddNode(node *Node) *Pipeline {
	p.nodes[node.Name] = node
	return p
}

// RemoveNode removes a node by name and returns the pipeline for chaining.
func (p *Pipeline) RemoveNode(name string) *Pipeline {
	delete(p.nodes, name)
	return p
}

// Clear resets the pipeline nodes; preserves chaining behavior.
func (p *Pipeline) Clear() *Pipeline {
	p.nodes = make(map[string]*Node)
	return p
}

// GetNode returns a node by name with an existence flag.
func (p *Pipeline) GetNode(name string) (*Node, bool) {
	node, ok := p.nodes[name]
	return node, ok
}

// HasNode reports whether a node with the given name exists.
func (p *Pipeline) HasNode(name string) bool {
	_, ok := p.nodes[name]
	return ok
}

// Len returns the number of nodes in the pipeline.
func (p *Pipeline) Len() int {
	return len(p.nodes)
}
