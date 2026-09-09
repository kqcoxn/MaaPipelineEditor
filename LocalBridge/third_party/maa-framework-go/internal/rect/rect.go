package rect

// Rect represents a 2D rectangle area
type Rect [4]int

func (r Rect) X() int {
	return r[0]
}

func (r Rect) Y() int {
	return r[1]
}

func (r Rect) Width() int {
	return r[2]
}

func (r Rect) Height() int {
	return r[3]
}
