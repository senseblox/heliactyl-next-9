import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  CpuChipIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon, 
  CheckIcon, 
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { MemoryStick, HardDrive } from 'lucide-react';

import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function ServerPackagePage() {
  const { id } = useParams();
  const [ram, setRam] = useState(0);
  const [disk, setDisk] = useState(0);
  const [cpu, setCpu] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Get server details
  const { data: server, isLoading: serverLoading } = useQuery({
    queryKey: ['server', id],
    queryFn: async () => {
      try {
        const { data } = await axios.get(`/api/server/${id}`);
        return data?.attributes;
      } catch (error) {
        console.error('Failed to fetch server:', error);
        throw error;
      }
    }
  });

  // Get user resources
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v5/resources');
      return data;
    }
  });

  // Set initial values from server limits
  useEffect(() => {
    if (server?.limits) {
      setRam(server.limits.memory);
      setDisk(server.limits.disk);
      setCpu(server.limits.cpu);
    }
  }, [server]);

  // Minimum resource values
  const minRAM = 128;
  const minDisk = 1024;
  const minCPU = 5;

  // Maximum resource values (current + remaining)
  const maxRAM = (server?.limits?.memory || 0) + (resources?.remaining?.ram || 0);
  const maxDisk = (server?.limits?.disk || 0) + (resources?.remaining?.disk || 0);
  const maxCPU = (server?.limits?.cpu || 0) + (resources?.remaining?.cpu || 0);

  const serverIdentifier = server?.identifier || id;

  const handleUpdate = async () => {
    try {
      setError('');
      setSuccess('');
      setIsUpdating(true);

      if (!ram || !disk || !cpu) {
        throw new Error('All resource values are required');
      }

      // Use identifier instead of id
      await axios.patch(`/api/v5/servers/${serverIdentifier}`, {
        ram: parseInt(ram),
        disk: parseInt(disk),
        cpu: parseInt(cpu)
      });

      // Reload page
        window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if resources have changed
  const hasChanges = 
    ram !== server?.limits?.memory || 
    disk !== server?.limits?.disk || 
    cpu !== server?.limits?.cpu;

  // Loading state
  if (serverLoading || resourcesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="w-6 h-6 text-[#95a1ad] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-screen-xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Package</h1>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setRam(server?.limits?.memory || 0);
              setDisk(server?.limits?.disk || 0);
              setCpu(server?.limits?.cpu || 0);
            }}
            disabled={!hasChanges || isUpdating}
            variant="outline"
            className="text-[#95a1ad] hover:text-white hover:bg-white/5 border-white/5"
          >
            Reset
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={!hasChanges || isUpdating}
            className="flex items-center gap-2"
          >
            {isUpdating ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500">
          <ExclamationCircleIcon className="w-4 h-4 mt-0.5 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20 text-green-500">
          <CheckIcon className="w-4 h-4 mt-0.5 mr-2" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-white/5 text-white p-6 flex items-start">
        <InformationCircleIcon className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm text-white">
            Adjust your server resources below. You might need to restart your server for changes to take effect.
          </p>
          <p className="text-sm text-white/70">
            {resources?.remaining?.ram === 0 && resources?.remaining?.disk === 0 && resources?.remaining?.cpu === 0 ? (
              <span>You've allocated all available resources. You can still reduce this server's resources if needed.</span>
            ) : (
              <span>You have {resources?.remaining?.ram.toLocaleString()}MB RAM, {resources?.remaining?.disk.toLocaleString()}MB storage, and {resources?.remaining?.cpu}% CPU available to allocate.</span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {/* Memory Slider */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#222427] border border-white/5">
              <MemoryStick className="w-5 h-5 text-[#95a1ad]" />
            </div>
            <div>
              <h3 className="text-base font-medium">Memory (RAM)</h3>
              <p className="text-sm text-[#95a1ad]">Allocate memory for your server to use</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#95a1ad]">Min: {minRAM}MB</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{ram}MB</span>
                <span className="text-xs px-3 py-1 rounded-full ml-2 border-white/5 border text-white/70">
                  Current: {server?.limits?.memory || 0}MB
                </span>
              </div>
            </div>
            <Slider
              value={[ram]}
              min={minRAM}
              max={Math.max(maxRAM, server?.limits?.memory || 0)}
              step={128}
              onValueChange={values => setRam(values[0])}
              className="py-2"
            />
          </div>
        </div>

        {/* Disk Slider */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#222427] border border-white/5">
              <HardDrive className="w-5 h-5 text-[#95a1ad]" />
            </div>
            <div>
              <h3 className="text-base font-medium">Disk Space</h3>
              <p className="text-sm text-[#95a1ad]">Storage space for your server files</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#95a1ad]">Min: {minDisk >= 1024 ? `${(minDisk/1024).toFixed(1)} GB` : `${minDisk} MB`}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{disk >= 1024 ? `${(disk/1024).toFixed(1)} GB` : `${disk} MB`}</span>
                <span className="text-xs px-3 py-1 rounded-full ml-2 border-white/5 border text-white/70">
                  Current: {(server?.limits?.disk || 0) >= 1024 ? `${((server?.limits?.disk || 0)/1024).toFixed(1)} GB` : `${server?.limits?.disk || 0} MB`}
                </span>
              </div>
            </div>
            <Slider
              value={[disk]}
              min={minDisk}
              max={Math.max(maxDisk, server?.limits?.disk || 0)}
              step={1024}
              onValueChange={values => setDisk(values[0])}
              className="py-2"
            />
          </div>
        </div>

        {/* CPU Slider */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#222427] border border-white/5">
              <CpuChipIcon className="w-5 h-5 text-[#95a1ad]" />
            </div>
            <div>
              <h3 className="text-base font-medium">CPU Limit</h3>
              <p className="text-sm text-[#95a1ad]">Processing power available to your server</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#95a1ad]">Min: {minCPU}%</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{cpu}%</span>
                <span className="text-xs px-3 py-1 rounded-full ml-2 border-white/5 border text-white/70">
                  Current: {server?.limits?.cpu || 0}%
                </span>
              </div>
            </div>
            <Slider
              value={[cpu]}
              min={minCPU}
              max={Math.max(maxCPU, server?.limits?.cpu || 0)}
              step={5}
              onValueChange={values => setCpu(values[0])}
              className="py-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}