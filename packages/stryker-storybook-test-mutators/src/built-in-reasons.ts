/** Why the install turns each of Stryker's 17 built-in mutators off in Storybook play functions. */
export const builtInReasons: Readonly<Record<string, string>> = {
  ArithmeticOperator:
    'Changes expected geometry and computed test data, which fails wherever it runs, or a sort comparator, which survives by construction.',
  ArrayDeclaration:
    'Empties expected arrays, which fails wherever it runs, or loop data and arrayContaining([]), which pass by construction.',
  ArrowFunction:
    'Empties waitFor callbacks, which then resolve at once, and array callbacks, which survive or fail wherever they run.',
  AssignmentOperator:
    'Changes local flags and counters, which fails wherever it runs.',
  BlockStatement:
    'Empties play, step, waitFor, loop and try bodies, which hold the checks, so the play passes by construction.',
  BooleanLiteral:
    'Flips expected booleans and query flags, which fails wherever it runs.',
  CallExpression:
    'Removes expect and helper assertion statements, which survive by construction; LzStorybookInteraction removes interaction statements.',
  ConditionalExpression:
    'Forces guards that a passing play never takes, which survive by construction, or that it always takes, which fail.',
  EqualityOperator:
    'Changes guards and predicates at boundaries that the play never reaches, or that fail wherever they run.',
  LogicalOperator:
    'Changes fallbacks and predicates, which are equivalent or fail wherever they run.',
  MethodExpression:
    'Changes trim, toLowerCase and filter calls on assertion subjects, which are equivalent or fail wherever they run.',
  ObjectLiteral:
    'Empties query options, which only loosen a query with one candidate, and expected objects or wait options, which pass by construction or fail.',
  OptionalChaining: 'Changes a null path that a passing play never takes.',
  Regex:
    'Widens or narrows a query pattern, which is equivalent, fails with a multiple-match error, or finds nothing and fails wherever it runs.',
  StringLiteral:
    'Empties roles, names and expected text, which Testing Library matches exactly, so the line fails wherever it runs, or negative checks, which pass by construction.',
  UnaryOperator:
    'Flips coordinate signs and negations, which fails wherever it runs.',
  UpdateOperator:
    'Changes loop counters, which hangs or fails wherever it runs.',
};
