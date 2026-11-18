# Spatial glass study desk

The supplied smart-home reference determines the visual direction: a real room backdrop, smoke-grey frosted control cards, luminous hairline borders, electric-blue active controls, a detached icon rail, and a floating subject dock. Study content replaces appliance controls; no mock messages or fabricated progress.

Keep React, Redux Toolkit, Framer Motion, and the existing SQLite API. Use CSS grid rather than a dashboard framework so the reference proportions remain controllable. Desktop uses a compact central bento and a separate question/revision rail. Tablet and mobile stack the same functional cards without horizontal overflow. Light mode remains available.

Readability revision: after viewing the working screen, the user requested more readable text. Labels and queue text are enlarged, detailed answers use 16–17px body text, card spacing increases, and reading surfaces are more opaque. The glass reference remains the direction, but its tiny text is not copied.

Motion: 160ms hover/press feedback, 190ms view opacity, immediate navigation state. No background motion or decorative loops. Reduced motion removes travel and transitions. Focus rings, labelled icon controls, and readable opaque reading panels take precedence over transparency.

Implementation: (1) add a local licensed photographic backdrop; (2) replace only the overview layout and navigation presentation; (3) retain and test question, answer, timer, record, and settings flows; (4) verify desktop, mobile, and light/dark appearance locally. No deployment.

Wallpaper: Brett Wharton / Unsplash, https://unsplash.com/photos/XaVW0jy1hd4 (Unsplash License). The user requested a dark library room rather than a living room; CSS adds the dark blue-grey treatment. This is a photograph, not an AI-generated asset.
