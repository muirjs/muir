<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/shadowcat-react

A StrykerJS ignorer for React styling code. StrykerJS mutates class name and inline style expressions. A DOM test
rarely sees those changes, so their mutants survive and lower the score. The opt-in `muir-shadowcat-react-styling`
ignorer reports them as Ignored, with a reason. Ignored mutants stay in the report and are left out of the score.

The package is private and not on npm yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x.
- React 16.14 or a later 16.x, 17, 18 or 19, tested on the oldest and the newest release of each: 16.14.0, 17.0.0,
  17.0.2, 18.0.0, 18.3.1, 19.0.0 and 19.3.1. The package imports nothing from React and states the range as an
  optional `react` peer dependency, so an install with another React version fails. Story files written for
  `@storybook/react-vite` are covered like component files.
- React JSX or TSX. The ignorer matches React's attribute names, such as `className` and `style` with an object
  value.

It does not need a particular test runner, and it does not need the mutators of `@muirjs/proteus-react`: it also hides
StrykerJS's own class name and style mutants.

## What it hides

It hides every mutant inside:

- A `className`, `class`, or `*ClassName` attribute with a `{...}` value, such as
  `className={cn('p-2', active && 'bg-accent')}` or a `NavLink` callback. Reason: "muir-shadowcat-react-styling: class
  names only style the element; DOM tests do not observe them".
- A call to `cn`, `clsx`, `classnames`, `classNames`, `cx`, `twMerge`, `cva`, or `tv` outside such an
  attribute. Reason: "muir-shadowcat-react-styling: class-name builder call; DOM tests do not observe class names".
- A variable whose name ends in `ClassName` or `Classes` and whose value is a string, a template or an
  object literal, such as `const sizeClasses = { sm: 'h-4', lg: 'h-8' }`. Reason: the same as for a class attribute.
- A `style` attribute with an object literal value, such as `style={{ color: on ? 'red' : 'blue' }}`.
  Reason: "muir-shadowcat-react-styling: inline styles only style the element; DOM tests do not observe them".

Static strings, such as `className="p-2"`, have no mutants to hide: StrykerJS skips them.

### Classes that hide an element

A class can hide an element, and Playwright's `toBeVisible` sees that. So the ignorer keeps the mutants of
a class attribute, call or variable when one of its strings, template parts or object keys holds one of
these classes:

`hidden`, `invisible`, `collapse`, `sr-only`, `not-sr-only`, `d-none`, `visually-hidden`, `is-hidden`.

It matches whole class names, split on whitespace. A class with variants matches by its last part, so
`md:hidden` and `peer-invalid:hidden` match. `overflow-hidden` and `hiddenish` do not.

Add your project's own hiding classes with `muirShadowcatReactStyling.visibilityClasses`. They add to the list above;
they do not replace it.

### Paint-only style keys

The ignorer hides the mutants of a `style` object literal only when every key is one of these paint-only
keys, in camelCase or kebab-case, quoted or not: `color`, `background`, `backgroundColor`,
`backgroundImage`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`,
`borderLeftColor`, `borderRadius`, `outlineColor`, `boxShadow`, `textShadow`, `textDecorationColor`,
`accentColor`, `caretColor`, `cursor`, `fill`, `stroke`.

It keeps the mutants of a `style` value in every other case:

- It is not an object literal, such as `style={styles.card}`.
- It has a spread (`...base`) or a computed key (`[name]: value`).
- It has any other key, such as `width`, `padding`, `border`, `display` or `fontSize`.

Any key that can change an element's size, position or visibility can change what a test observes.
Playwright reads the box for `toBeVisible`, `toBeInViewport` and clicks, and an app can measure its own
elements. In react-virtuoso's e2e suite, a mutant that removed a list item's `border` or a list's `padding`
changed which items rendered, and a test caught it.

## Turn it on

List the package in `appendPlugins` or `plugins`, then the ignorer:

```ts
appendPlugins: ['@muirjs/shadowcat-react'],
ignorers: ['muir-shadowcat-react-styling'],
muirShadowcatReactStyling: {
  visibilityClasses: ['closed', 'is-collapsed'],
},
```

`appendPlugins` keeps the plugins Stryker loads by default. `plugins` replaces them, so a checker such as
`@stryker-mutator/typescript-checker` does not load unless the list names it too. Stryker finds its
default plugins by listing the `@stryker-mutator` folder next to its own install, which under pnpm or Yarn
Plug'n'Play does not hold your checker. With either, name the checker in `appendPlugins`, as in
`'@stryker-mutator/typescript-checker'`.

`visibilityClasses` must be an array of class names without whitespace. Stryker checks it against the
schema the package exports, and the ignorer throws when it is created with any other value.

To use it with the other Shadowcat ignorers, list each package and each ignorer:

```ts
appendPlugins: ['@muirjs/shadowcat-react', '@muirjs/shadowcat-telemetry', '@muirjs/shadowcat-js'],
ignorers: ['muir-shadowcat-react-styling', 'muir-shadowcat-telemetry', 'muir-shadowcat-js-console'],
```

## When to leave it out

Leave `muir-shadowcat-react-styling` out when your tests assert classes or styles, with `toHaveClass`, `toHaveCSS` or
`toHaveStyle`. Those tests can kill the mutants it hides. A `// Stryker restore` comment does not bring
them back; only leaving the ignorer out does.

Leave it out, or add the class to `visibilityClasses`, when your own CSS hides an element through a class
the list above does not name.

## License

MIT
