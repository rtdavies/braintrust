# To do list
1. ~~Connect to websocket server~~
1. ~~Subscribe to facial events~~
1. ~~Add text field for URL (and any other text inputs?)~~
1. ~~Convert the start() function to connect(). Don't subscribe to any events during start.~~
1. ~~Add checkboxes for each event stream type (e.g. "fac" or "mot"), disabled when not connected.~~
1. ~~Enable checkboxes on connection (clear any previously checked boxed before enabling).~~
1. ~~Subscribe when checked, unsubscribe when unchecked.~~
1. ~~Put form in div.~~
1. ~~Disable the connect button after successful connection.~~
1. ~~Checkbox to enable/disable logging events~~
1. ~~add try/catch blocks around form processing to ensure the functions always return false (and thus the page is never reloaded by a form submission~~)
1. ~~Rate limit event processing (only process events every n millis)~~
1. ~~Create model to back UI with 1 event type (e.g. smile)~~
1. ~~Create a UI animation. Trigger when model says so (e.g. rate-limited, smiling yes/no, intensity of animation based on strength of smile)~~
1. ~~Add additional events to model~~
1. ~~Add twisty to fold input div closed/open~~
1. ~~Fill the screen for demo~~
1. ~~Create baseline animation (when no events are being received)~~
~~1. Make branch with 3 animation divs in one row (blink, smile, frown)~~
1. Make branch with different animations (pulse fast, pulse slow, flash, heart beat)
1. Simplify playing with colors (e.g. add color selection/specification to UI?)
1. Reconnect when connection lost (with same input values)
1. Add motion events to model