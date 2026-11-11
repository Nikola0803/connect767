import { describe, expect, it } from "vitest";
import { listingEducationDetails } from "./ListingProfile";

describe("listingEducationDetails", () => {
  it("hides both profile details when neither listing-form field is filled", () => {
    expect(
      listingEducationDetails({
        highestDegreeLevel: "   ",
        degreeType: "",
      }),
    ).toEqual([]);
  });

  it("shows only Highest Degree Level when Degree Type is blank", () => {
    expect(
      listingEducationDetails({
        highestDegreeLevel: "Master's Degree",
        degreeType: "   ",
      }),
    ).toEqual([
      {
        icon: "ri-graduation-cap-line",
        text: "Master's Degree",
        title: "Highest Degree Level: Master's Degree",
      },
    ]);
  });

  it("shows only Degree Type when Highest Degree Level is blank", () => {
    expect(
      listingEducationDetails({
        highestDegreeLevel: "",
        degreeType: "Business Administration",
      }),
    ).toEqual([
      {
        icon: "ri-book-open-line",
        text: "Business Administration",
        title: "Degree Type: Business Administration",
      },
    ]);
  });

  it("shows both completed education details", () => {
    expect(
      listingEducationDetails({
        education: "Bachelor's Degree",
        degreeType: "Computer Science",
      }),
    ).toHaveLength(2);
  });
});
