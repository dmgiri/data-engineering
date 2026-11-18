# Navigation motion spec

## Motion tokens

| Token | Value | Easing | Used for |
| --- | --- | --- | --- |
| Existing control feedback | 140 ms | project `--ease` | Hover, focus, and press feedback |
| Navigation state feedback | Immediate layout | none | Main content expands or contracts without animating layout dimensions |

## Interaction inventory

| Interaction | Trigger | Feedback | Status |
| --- | --- | --- | --- |
| Collapse navigation | Collapse button | Sidebar becomes a 74 px icon rail; control icon, accessible label, and expanded state change | Implemented |
| Expand navigation | Expand button | Full labels and study-plan card return | Implemented |
| Mobile navigation | Menu button | Existing full drawer remains unchanged; desktop collapse control is hidden | Preserved |

## Deliberately not animated

- Grid-column width is not animated because layout-property animation can stutter and adds no useful study feedback.
- Navigation labels rely on the structural state, changed icon, and accessible label rather than motion alone.
- The project-wide reduced-motion rule continues to remove nonessential transitions.
