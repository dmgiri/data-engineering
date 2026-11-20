# Workspace Close Buttons Design

## Intent

Give Study Material and My Notes an unmistakable exit action at the top-right so users can return to the dashboard without searching for navigation.

## Design

- Add one shared large red control with a white `X` and the label `Close`.
- Place it at the far right of the Study Material header and the My Notes command ribbon.
- Study Material closes directly to Dashboard.
- My Notes reuses the existing unsaved-change confirmation before closing.
- On narrow screens, keep the red control visible and hide only its text label.

## Approaches

- Selected: shared styled button in each existing top toolbar; it is clear, consistent, and responsive.
- Rejected: fixed overlay button, because it can cover reading or editing content.
- Rejected: retain only the small Notes exit icon and clickable Study Material logo, because neither matches the requested prominent red action.
