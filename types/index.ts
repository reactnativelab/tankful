export type VehicleType = 'bike' | 'car' | 'other';

export type FuelType = 'petrol' | 'diesel' | 'cng';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  fuelType: FuelType;
  plate: string | null;
  createdAt: number;
}

export type NewVehicle = Omit<Vehicle, 'id' | 'createdAt'>;

export type VehicleUpdate = Partial<NewVehicle>;

export interface FuelEntry {
  id: string;
  vehicleId: string;
  date: number;
  odometer: number;
  litresFilled: number;
  pricePerLitre: number;
  totalCost: number;
  isTankFull: boolean;
  notes: string | null;
  createdAt: number;
}

export type NewFuelEntry = Omit<FuelEntry, 'id' | 'createdAt' | 'totalCost'> & {
  totalCost?: number;
};

export type FuelEntryUpdate = Partial<Omit<FuelEntry, 'id' | 'createdAt'>>;

export type DistanceUnit = 'km' | 'mi';

export interface AppSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}
