export default async function* getActions(
  taksargs: any,
): AsyncGenerator<
  { progress: number; message: string; error?: any },
  void,
  unknown
> {
  yield { progress: 0, message: "Starting import..." };
  for (let i = 1; i <= 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate work
    // if (i === 90) throw new Error("Error at 90%");
    if (i === 90)
      yield { error: "yield error", message: "nothing", progress: 90 };

    yield { progress: i, message: `Importing... ${i}%` };
  }
}
