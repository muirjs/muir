import { type Case, inPlay } from './support/case.ts';

const waitFor = 'LzStorybookWaitFor';

export const waitForCases: readonly Case[] = [
  {
    id: 'wait-for-arrow',
    title:
      'a waitFor of an arrow with an expression body runs the body once, in an async arrow',
    source: inPlay(
      "await waitFor(() => expect(canvas.getByText('Saved')).toBeVisible());",
    ),
    expect: [
      [
        waitFor,
        "(async () => expect(canvas.getByText('Saved')).toBeVisible())()",
      ],
    ],
  },
  {
    id: 'wait-for-find-by',
    title: 'a findBy query becomes the getBy query on the same receiver',
    source: inPlay("await canvas.findByText('Saved');"),
    expect: [[waitFor, "canvas.getByText('Saved')"]],
  },
  {
    id: 'wait-for-find-all-by',
    title: 'a findAllBy query becomes the getAllBy query on the same receiver',
    source: inPlay("await screen.findAllByRole('row');"),
    expect: [[waitFor, "screen.getAllByRole('row')"]],
  },
  {
    id: 'wait-for-element-removed',
    title: 'a waitForElementToBeRemoved statement is removed',
    source: inPlay(
      "await waitForElementToBeRemoved(() => canvas.queryByRole('progressbar'));",
    ),
    expect: [[waitFor, ';']],
  },
  {
    id: 'wait-for-vi',
    title: "Vitest's vi.waitFor makes no mutant",
    source: inPlay('await vi.waitFor(() => expect(spy).toHaveBeenCalled());'),
    expect: [],
  },
];
