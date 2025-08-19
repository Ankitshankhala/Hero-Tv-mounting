import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Navigation, ChevronDown, Map, MapPin } from 'lucide-react';
import { MapApp, openDirections, getPreferredMapApp, setPreferredMapApp } from '@/utils/maps';

interface MapAppSelectorProps {
  address: string;
  className?: string;
}

const mapAppConfig = {
  apple: { name: 'Apple Maps', icon: Map },
  google: { name: 'Google Maps', icon: MapPin },
  waze: { name: 'Waze', icon: Navigation }
};

export const MapAppSelector = ({ address, className }: MapAppSelectorProps) => {
  const handleMapSelection = (mapApp: MapApp) => {
    setPreferredMapApp(mapApp);
    openDirections(address, mapApp);
  };

  const handleDefaultDirections = () => {
    openDirections(address);
  };

  const preferredApp = getPreferredMapApp();
  const PreferredIcon = mapAppConfig[preferredApp].icon;

  return (
    <div className="flex">
      <Button
        onClick={handleDefaultDirections}
        size="sm"
        variant="outline"
        className="rounded-r-none border-r-0"
      >
        <PreferredIcon className="h-4 w-4 mr-2" />
        Directions
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="rounded-l-none px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.entries(mapAppConfig).map(([key, config]) => {
            const IconComponent = config.icon;
            return (
              <DropdownMenuItem
                key={key}
                onClick={() => handleMapSelection(key as MapApp)}
                className="flex items-center gap-2"
              >
                <IconComponent className="h-4 w-4" />
                {config.name}
                {preferredApp === key && (
                  <span className="ml-auto text-xs text-muted-foreground">Default</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};