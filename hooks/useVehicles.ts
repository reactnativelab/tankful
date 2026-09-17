import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getVehicles } from '@/db/vehicles';
import type { Vehicle } from '@/types';

/** Vehicle list, refetched whenever the screen regains focus (e.g. after adding one). */
export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getVehicles();
    setVehicles(data);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { vehicles, loading, refresh };
}
