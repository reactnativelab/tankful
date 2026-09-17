import type { FuelType, VehicleType } from '@/types';

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: 'bike', label: 'Bike' },
  { value: 'car', label: 'Car' },
  { value: 'other', label: 'Other' },
];

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'cng', label: 'CNG' },
];

export function vehicleTypeLabel(type: VehicleType): string {
  return VEHICLE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function fuelTypeLabel(type: FuelType): string {
  return FUEL_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}
