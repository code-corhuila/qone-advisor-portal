import { render, screen, within } from "@testing-library/react";
import { RichText } from "./RichText";

// The advisor answers in plain text with the habits of a chat model: paragraphs, "-" or "1."
// lists and **bold**. They are shown as such, as React elements (never as injected HTML).
describe("RichText", () => {
  it("turns paragraphs, bullet and numbered lists and bold into elements", () => {
    render(
      <RichText text={"Te faltan:\n\n- **ISW-601** Bases de Datos II\n- ISW-602 Teoría\n\n1. Primero\n2. Después\n\nTotal: 14 de 42."} />,
    );

    const [bullets, numbers] = screen.getAllByRole("list");
    expect(bullets!.tagName).toBe("UL");
    expect(within(bullets!).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ISW-601 Bases de Datos II", "ISW-602 Teoría"]);
    expect(within(bullets!).getByText("ISW-601").tagName).toBe("STRONG");
    expect(numbers!.tagName).toBe("OL");
    expect(within(numbers!).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Te faltan:").tagName).toBe("P");
    expect(screen.getByText("Total: 14 de 42.").tagName).toBe("P");
  });

  it("keeps markup in the text as text", () => {
    render(<RichText text={'<img src=x onerror="alert(1)"> hola'} />);

    expect(screen.getByText('<img src=x onerror="alert(1)"> hola')).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
