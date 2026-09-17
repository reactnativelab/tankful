import { useCallback, useEffect, useState } from 'react';
import { addFuelEntry, OdometerValidationError } from '@/db/fuelEntries';
import { formatOdometer } from '@/utils/format';

export interface LogFillupFieldErrors {
  odometer: string | null;
  litresFilled: string | null;
  pricePerLitre: string | null;
}

const NO_FIELD_ERRORS: LogFillupFieldErrors = {
  odometer: null,
  litresFilled: null,
  pricePerLitre: null,
};

/** Parses a required, positive numeric field. Returns null when blank, NaN, or <= 0. */
function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Form state + validation for the Log Fill-up modal. Total cost auto-fills
 * from litres * price until the user edits it directly, tracked via
 * totalCostManuallyEdited so a later litres/price tweak doesn't clobber
 * their override.
 */
export function useLogFillupForm(vehicleId: string | null) {
  const [date, setDate] = useState(() => new Date());
  const [odometer, setOdometer] = useState('');
  const [litresFilled, setLitresFilled] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [totalCost, setTotalCostRaw] = useState('');
  const [totalCostManuallyEdited, setTotalCostManuallyEdited] = useState(false);
  const [isTankFull, setIsTankFull] = useState(true);
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<LogFillupFieldErrors>(NO_FIELD_ERRORS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (totalCostManuallyEdited) return;
    const litres = parsePositiveNumber(litresFilled);
    const price = parsePositiveNumber(pricePerLitre);
    setTotalCostRaw(litres !== null && price !== null ? (litres * price).toFixed(2) : '');
  }, [litresFilled, pricePerLitre, totalCostManuallyEdited]);

  const setTotalCost = useCallback((value: string) => {
    setTotalCostManuallyEdited(true);
    setTotalCostRaw(value);
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitError(null);

    const odometerValue = parsePositiveNumber(odometer);
    const litresValue = parsePositiveNumber(litresFilled);
    const priceValue = parsePositiveNumber(pricePerLitre);

    setFieldErrors({
      odometer: odometerValue === null ? 'Enter a valid odometer reading' : null,
      litresFilled: litresValue === null ? 'Enter a valid number of litres' : null,
      pricePerLitre: priceValue === null ? 'Enter a valid price per litre' : null,
    });

    if (!vehicleId || odometerValue === null || litresValue === null || priceValue === null) {
      return false;
    }

    // Guards against a blank/invalid manual override reaching the DB as NaN.
    const totalCostValue = parsePositiveNumber(totalCost) ?? litresValue * priceValue;
    const trimmedNotes = notes.trim();

    setSubmitting(true);
    try {
      await addFuelEntry({
        vehicleId,
        date: date.getTime(),
        odometer: odometerValue,
        litresFilled: litresValue,
        pricePerLitre: priceValue,
        totalCost: totalCostValue,
        isTankFull,
        notes: trimmedNotes === '' ? null : trimmedNotes,
      });
      return true;
    } catch (error) {
      if (error instanceof OdometerValidationError) {
        setFieldErrors((prev) => ({
          ...prev,
          odometer: `Must be greater than last reading of ${formatOdometer(error.previousOdometer, 'km')}`,
        }));
      } else {
        setSubmitError('Something went wrong saving this fill-up. Please try again.');
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [vehicleId, date, odometer, litresFilled, pricePerLitre, totalCost, isTankFull, notes]);

  return {
    date,
    setDate,
    odometer,
    setOdometer,
    litresFilled,
    setLitresFilled,
    pricePerLitre,
    setPricePerLitre,
    totalCost,
    setTotalCost,
    isTankFull,
    setIsTankFull,
    notes,
    setNotes,
    fieldErrors,
    submitError,
    submitting,
    submit,
  };
}

export type UseLogFillupFormResult = ReturnType<typeof useLogFillupForm>;
