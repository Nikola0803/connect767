import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import ProductInventoryEditor from "./ProductInventoryEditor";

const baseForm = {
  productType: "simple",
  trackStock: true,
  stockQuantity: "10",
  lowStockThreshold: "3",
  variants: [],
};

function Harness() {
  const [form, setForm] = useState(baseForm);
  return <ProductInventoryEditor form={form} setForm={setForm} />;
}

describe("ProductInventoryEditor", () => {
  it("offers simple and variable inventory modes", () => {
    render(<Harness />);

    expect(screen.getByRole("radio", { name: /simple item/i })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: /stock quantity/i })).toHaveValue(10);

    fireEvent.click(screen.getByText("Variable product"));

    expect(screen.getByRole("radio", { name: /variable product/i })).toBeChecked();
    expect(screen.getByLabelText("Size")).toBeInTheDocument();
    expect(screen.getByLabelText("Color")).toBeInTheDocument();
    expect(screen.getByLabelText(/low-stock alert/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add variation/i })).toBeInTheDocument();
  });

  it("adds another independently managed variation", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Variable product"));
    fireEvent.click(screen.getByRole("button", { name: /add variation/i }));

    expect(screen.getAllByLabelText("Size")).toHaveLength(2);
    expect(screen.getAllByLabelText("Color")).toHaveLength(2);
  });
});
