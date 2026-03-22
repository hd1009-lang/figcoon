function App() {
  const handleCreate = () => {
    const count = 5;
    parent.postMessage(
      { pluginMessage: { type: "create-shapes", count } },
      "*",
    );
    // Implementation for creating rectangles
  };

  return (
    <div className="">
      <h2 className="text-amber-200">Rectangle Creator</h2>
      <p className="text-red-400">
        Count: <input id="count" type="number" value="5" />
      </p>
      <button id="create" onClick={handleCreate}>Create2</button>
    </div>
  );
}

export default App;
