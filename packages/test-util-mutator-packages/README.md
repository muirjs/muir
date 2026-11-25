# @muirjs/test-util-mutator-packages

Test support that the `@muirjs` mutator packages share. It is private: no package depends on it at run time,
and it is not published.

- `muirTempRoot(t, prefix)` makes a temporary folder that the test `t` removes when it ends.
  `muirWriteTree(dir, files)` writes a tree of files into a folder.
- `muirTestReadmeTiers(readmePath, tiers, facts)` registers tests that check a mutator package's README against
  its mutator tiers: the opening and the default install line give the size of each tier, each tier's table lists
  its mutators in roster order, and "None." stands under each empty tier's heading and only there.
- `muirComposeSkips(...)`, from `@muirjs/test-util-mutator-packages/compose-skips`, registers one test that
  composes each case's Storybook stories with and without each property a mutator skips, and fails a row where
  the two differ. The Storybook mutator packages use it to prove their equivalence skips.

Run its tests with `npx nx test @muirjs/test-util-mutator-packages`.
