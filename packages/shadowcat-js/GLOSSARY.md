# Shadowcat ignorers

Opt-in StrykerJS ignorers that report as Ignored the mutants a DOM test does not observe: console output
(`@muirjs/shadowcat-js`), analytics and error-monitoring calls (`@muirjs/shadowcat-telemetry`), and React class
names and inline styles (`@muirjs/shadowcat-react`). Each package names the technology its ignorer is specific to.

## Language

### Ignorers

**Styling ignorer**:
The opt-in `muir-shadowcat-react-styling` ignorer, for mutants in class names and inline styles, which a DOM test does
not observe.
_Avoid_: class ignorer, CSS ignorer

**Telemetry ignorer**:
The opt-in `muir-shadowcat-telemetry` ignorer, for mutants in analytics and error-monitoring calls, Sentry's included.
_Avoid_: analytics ignorer, tracking ignorer, Sentry ignorer

**Console ignorer**:
The opt-in `muir-shadowcat-js-console` ignorer, for mutants in calls to the chosen `console` methods.
_Avoid_: logging ignorer

### Styling

**Class-name builder**:
A function that joins class names, such as `cn`, `clsx` or `cva`, whose call the styling ignorer treats like a
class attribute.

**Visibility class**:
A class name that can hide an element, such as `hidden` or `sr-only`; the styling ignorer keeps the mutants of
any class value that holds one.
_Avoid_: hiding class

**Paint-only style key**:
An inline style key that changes only how an element is painted, not its size, position or visibility, such as
`color` or `boxShadow`. Only a `style` object with nothing but such keys has its mutants ignored.
_Avoid_: cosmetic style, visual-only property

### Calls

**Telemetry callee**:
The dotted name of a function, such as `analytics.track` or `Sentry.captureException`, whose call statements the
telemetry ignorer ignores; a project adds its own through `muirShadowcatTelemetry.calls`.
_Avoid_: tracker, telemetry call (for the name)

**Call statement**:
A statement that is nothing but one call, optionally under `await` or `void`, whose result no code uses. The
telemetry and console ignorers ignore only call statements.
_Avoid_: bare call, standalone call

**Effect argument**:
An argument of a call statement that can act on the page, such as a function, another call, an assignment or
`await`. A call statement with one keeps all its mutants.
_Avoid_: side-effect argument, callback (too narrow)
