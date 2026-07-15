---
description: A slider component that can be used to zoom in and out
---

import UiComponentViewer from '@/components/ui-component-viewer.mdx';

# Node Search

A search bar component that can be used to search for nodes in the flow.

It uses the [Command](https://ui.shadcn.com/docs/components/command) component from [shadcn ui](https://ui.shadcn.com).

By default, it will check for lowercase string inclusion in the node's label, and 
select the node and fit the view to the node when it is selected.
You can override this behavior by passing a custom `onSearch` function.
You can also override the default `onSelectNode` function to customize the behavior when a node is selected.

<UiComponentViewer id="node-search" />
