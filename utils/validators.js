// Shared request validators. (Purane controllers abhi scripts/backfillWorkerId.js se
// same functions import karte hain — naya code yahan se import kare.)

// Optional field: undefined/null/"" ko valid maanta hai — required check alag se karo.
export const isValidNonNegativeNumber = (value) => {
  if (value === undefined || value === null || value === "") return true;
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0;
};

export const isValidObjectIdString = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

export const isMongooseInputError = (error) =>
  error?.name === "ValidationError" || error?.name === "CastError";
