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
| Notebook page pane expand | Selected section chevron | The separate page pane appears and its contents fade 4 px into place; chevron and `aria-expanded` also change | Implemented |
| Notebook section rail collapse | Pane button | The section rail becomes a compact color-tab rail; the editor gains space immediately | Implemented |
| Section color menu | Palette button | Color choices fade in beside the selected section | Implemented |
| Enter or exit full-window Notes | My notes or Exit notes control | The existing screen transition fades the new view over 140 ms; the notebook itself does not animate its dimensions | Implemented |

## Deliberately not animated

- Grid-column width is not animated because layout-property animation can stutter and adds no useful study feedback.
- Navigation labels rely on the structural state, changed icon, and accessible label rather than motion alone.
- The project-wide reduced-motion rule continues to remove nonessential transitions.
- Notebook page and color-menu contents do not animate when reduced motion is requested.
