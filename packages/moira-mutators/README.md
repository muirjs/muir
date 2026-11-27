<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/moira-mutators

The code that puts custom mutators into StrykerJS. It is not a mutator package and has no mutators of its own. Every
mutator package installs through it: `@muirjs/proteus-js`, `@muirjs/proteus-node`, `@muirjs/proteus-node-test`,
`@muirjs/proteus-react`, `@muirjs/proteus-msw`, `@muirjs/proteus-playwright`, `@muirjs/proteus-storybook` and
`@muirjs/proteus-storybook-test`. The package is private and is not for direct use. Each mutator package declares it
as a regular dependency, so installing one installs this one.

StrykerJS has no public way to add a mutator to its instrumenter or to turn off a built-in one. This package
patches the installed `@stryker-mutator/instrumenter` in memory, in each copy of Stryker core that may run the process,
and checks that the patch took effect.

## Exports

- `muirMoiraMutatorsInstall`: a mutator package's whole install. It selects the mutators from the options, checks
  their names, optionally removes the 17 built-ins, registers the mutators in each instrumenter, applies a package's
  own patch, self-checks each instrumenter, and warns once for each instrumenter version other than the tested one.
  When a step throws, every list and patched object is put back as it was.
- `muirMoiraMutatorsInstallBabelMutators`, `muirMoiraMutatorsResolveBabelInstrumenter`,
  `muirMoiraMutatorsToStrykerMutator`, `muirMoiraMutatorsAssertBabelTypes`, `muirMoiraMutatorsBabelBuilders`: the
  install for mutators written as Babel mutators, which the Node mutator packages use.
- `muirMoiraMutatorsCorePackageJsons`, `muirMoiraMutatorsResolveEachCore`, `muirMoiraMutatorsResolveInstrumenter`,
  `muirMoiraMutatorsCoreInstrument`: find each copy of `@stryker-mutator/core` that may run the process, and load
  the instrumenter it uses. `muirMoiraMutatorsCoreInstrument` takes an optional Stryker `Logger` as its third
  argument; without one, the instrumenter logs nothing.
- `muirMoiraMutatorsResolveExpressionPlacer`: the instrumenter's expression placer, for a package that patches it.
  The other functions do not need the placer to exist.
- `muirMoiraMutatorsFieldOf`, `muirMoiraMutatorsIsRecord`: read a field of a value of unknown shape, and test for an
  object.
- `muirMoiraMutatorsRegister`, `muirMoiraMutatorsMarkOf`: put mutators in its list, each marked as a `@muirjs`
  mutator. A second call replaces the entries of the first from the same package, in place, and leaves the entries
  of other packages where they are.
- `muirMoiraMutatorsCheckNames`: throws on a mutator name that has other characters than letters, or that another
  package's mutator already has (compared without case).
- `muirMoiraMutatorsSelfCheck`: instruments one sample per mutator and throws when the instrumenter makes no mutant
  of it.
- `muirMoiraMutatorsSelfCheckFile`, `muirMoiraMutatorsIsSelfCheckFile`: the name of the sample file that the
  self-check instruments for a mutator, and the test of whether a file name is one, for a package's own patch that
  must tell the samples from the user's files.
- `muirMoiraMutatorsUndoOnThrow`: runs an install's changes and the checks after them. When one of them throws, it
  gives each object it was handed, such as the mutator list or the expression placer, back the own properties it had
  before, and rethrows. The restore is shallow, and it needs objects that can take new properties, as both of those
  can.
- `muirMoiraMutatorsWarnUntested`: warns when the instrumenter is not the version the calling package was tested
  with.
- `muirMoiraMutatorsBuiltInNames`, `muirMoiraMutatorsRemoveBuiltIns`: the 17 built-in mutators of Stryker, and the
  removal of them by name.
- `muirMoiraMutatorsBuiltInSample`, `muirMoiraMutatorsCheckBuiltInsRemoved`: a source file in which each of the 17
  makes a mutant, and the check that throws when the instrumenter still makes one of them after the removal.
- `muirMoiraMutatorsSelectMutators`, `muirMoiraMutatorsAllMutators`: turn the options of a mutator package into the
  list of mutators to install, and list every mutator of its tiers. The options and an `experimental` object are
  plain objects, an object literal or an object without a prototype, and only their own keys count. An option holds
  only `true`. The function throws on any other value, on any unknown or misplaced name, and on `extended` or
  `experimental` for a tier with no mutators.
- `muirMoiraMutatorsSwapMutator` and its site readers: the swap engine that makes same-file swap mutators.
- The AST readers in `ast.ts`, such as `muirMoiraMutatorsImportOf` and `muirMoiraMutatorsMemberNameOf`, that more
  than one mutator package uses.
- Types for the instrumenter's parts, the mutators and the install options, each with the `MuirMoiraMutators` prefix.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1. `muirMoiraMutatorsWarnUntested` warns when it finds another
  version.
- `@babel/core` 8.0, Stryker 10's Babel, for the Babel mutators.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x.
