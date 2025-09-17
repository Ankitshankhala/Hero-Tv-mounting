import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  BarChart3,
  Plus,
  Search,
  Loader2
} from 'lucide-react';
import { 
  zctaOnlyService, 
  ZctaValidationResult, 
  WorkerAreaAssignment,
  BookingAssignmentDetails,
  ZctaCoverageStats,
  WorkerZctaArea 
} from '@/services/zctaOnlyService';
import { supabase } from '@/integrations/supabase/client';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const ZctaManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [coverageStats, setCoverageStats] = useState<ZctaCoverageStats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [workerAreas, setWorkerAreas] = useState<WorkerZctaArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ZCTA Validation
  const [zctaCode, setZctaCode] = useState('');
  const [validationResult, setValidationResult] = useState<ZctaValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Worker Assignment
  const [areaName, setAreaName] = useState('');
  const [zctaCodes, setZctaCodes] = useState('');
  const [assignmentResult, setAssignmentResult] = useState<any>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Booking Details
  const [bookingId, setBookingId] = useState('');
  const [bookingDetails, setBookingDetails] = useState<BookingAssignmentDetails | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load worker areas when worker is selected
  useEffect(() => {
    if (selectedWorker) {
      loadWorkerAreas(selectedWorker);
    }
  }, [selectedWorker]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load coverage stats and workers in parallel
      const [statsResult, workersResult] = await Promise.all([
        zctaOnlyService.getZctaCoverageStats(),
        supabase
          .from('users')
          .select('id, name, email, phone')
          .eq('role', 'worker')
          .eq('is_active', true)
      ]);

      setCoverageStats(statsResult);
      if (workersResult.data) {
        setWorkers(workersResult.data);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkerAreas = async (workerId: string) => {
    try {
      const areas = await zctaOnlyService.getWorkerZctaCodesWithAreas(workerId);
      setWorkerAreas(areas);
    } catch (error) {
      console.error('Error loading worker areas:', error);
      setError('Failed to load worker areas');
    }
  };

  const validateZctaCode = async () => {
    if (!zctaCode.trim()) return;

    setValidationLoading(true);
    setError(null);
    
    try {
      const result = await zctaOnlyService.validateZctaCode(zctaCode);
      setValidationResult(result);
    } catch (error) {
      console.error('Error validating ZCTA code:', error);
      setError('Failed to validate ZCTA code');
    } finally {
      setValidationLoading(false);
    }
  };

  const assignWorkerToZctaCodes = async () => {
    if (!selectedWorker || !areaName.trim() || !zctaCodes.trim()) {
      setError('Please fill in all assignment fields');
      return;
    }

    setAssignmentLoading(true);
    setError(null);

    try {
      const zctaCodeArray = zctaCodes.split(',').map(code => code.trim()).filter(code => code);
      const result = await zctaOnlyService.assignWorkerToZctaCodes(
        selectedWorker,
        areaName,
        zctaCodeArray
      );

      setAssignmentResult(result);
      
      if (result.success) {
        // Reload worker areas and coverage stats
        await Promise.all([
          loadWorkerAreas(selectedWorker),
          loadInitialData()
        ]);
        
        // Clear form
        setAreaName('');
        setZctaCodes('');
      }
    } catch (error) {
      console.error('Error assigning worker:', error);
      setError('Failed to assign worker to ZCTA codes');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const getBookingDetails = async () => {
    if (!bookingId.trim()) return;

    setBookingLoading(true);
    setError(null);

    try {
      const details = await zctaOnlyService.getBookingAssignmentDetails(bookingId);
      setBookingDetails(details);
    } catch (error) {
      console.error('Error getting booking details:', error);
      setError('Failed to get booking details');
    } finally {
      setBookingLoading(false);
    }
  };

  const getDataSourceBadge = (dataSource: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      'zcta_boundary': { variant: 'default', label: 'ZCTA Boundary' },
      'postal_only': { variant: 'secondary', label: 'Postal Only' },
      'not_found': { variant: 'destructive', label: 'Not Found' },
      'invalid': { variant: 'destructive', label: 'Invalid' }
    };

    const config = variants[dataSource] || { variant: 'outline', label: dataSource };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && !coverageStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading ZCTA dashboard...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ZCTA Management Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          ZCTA-Only System
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="validation">ZCTA Validation</TabsTrigger>
          <TabsTrigger value="assignment">Worker Assignment</TabsTrigger>
          <TabsTrigger value="booking">Booking Details</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {coverageStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total ZCTA Codes</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{coverageStats.total_zcta_codes.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Available in system</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Covered ZCTA Codes</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{coverageStats.covered_zcta_codes.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {coverageStats.coverage_percentage}% coverage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{coverageStats.total_workers}</div>
                  <p className="text-xs text-muted-foreground">Providing coverage</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Service Areas</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{coverageStats.total_areas}</div>
                  <p className="text-xs text-muted-foreground">Active areas</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Top States */}
          {coverageStats?.top_states && (
            <Card>
              <CardHeader>
                <CardTitle>Coverage by State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(coverageStats.top_states)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([state, count]) => (
                      <div key={state} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{state}</span>
                        <Badge variant="secondary">{count} ZCTA codes</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ZCTA Validation Tab */}
        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ZCTA Code Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ZCTA code (e.g., 75201)"
                  value={zctaCode}
                  onChange={(e) => setZctaCode(e.target.value)}
                  maxLength={5}
                />
                <Button 
                  onClick={validateZctaCode}
                  disabled={validationLoading || !zctaCode.trim()}
                >
                  {validationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Validate
                </Button>
              </div>

              {validationResult && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {validationResult.is_valid ? 'Valid ZCTA Code' : 'Invalid ZCTA Code'}
                    </h3>
                    {getDataSourceBadge(validationResult.data_source)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>ZCTA Code:</strong> {validationResult.zcta_code}</div>
                    <div><strong>City:</strong> {validationResult.city}</div>
                    <div><strong>State:</strong> {validationResult.state} ({validationResult.state_abbr})</div>
                    <div><strong>Area:</strong> {validationResult.total_area_sq_miles} sq mi</div>
                    <div><strong>Coordinates:</strong> {validationResult.centroid_lat.toFixed(4)}, {validationResult.centroid_lng.toFixed(4)}</div>
                    <div><strong>Boundary Data:</strong> {validationResult.has_boundary_data ? 'Available' : 'Not Available'}</div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm">
                    {validationResult.can_use_for_service ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Can use for service areas
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <XCircle className="h-4 w-4 mr-1" />
                        Cannot use for service areas
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Worker Assignment Tab */}
        <TabsContent value="assignment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Worker to ZCTA Codes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Select Worker</Label>
                  <select
                    value={selectedWorker}
                    onChange={(e) => setSelectedWorker(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select a worker</option>
                    {workers.map(worker => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} ({worker.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Area Name</Label>
                  <Input
                    placeholder="e.g., Downtown Dallas Area"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                  />
                </div>

                <div>
                  <Label>ZCTA Codes (comma-separated)</Label>
                  <Input
                    placeholder="e.g., 75201, 75202, 75203"
                    value={zctaCodes}
                    onChange={(e) => setZctaCodes(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={assignWorkerToZctaCodes}
                  disabled={assignmentLoading || !selectedWorker || !areaName.trim() || !zctaCodes.trim()}
                  className="w-full"
                >
                  {assignmentLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Assign Worker to ZCTA Codes
                </Button>
              </div>

              {assignmentResult && (
                <Alert variant={assignmentResult.success ? "default" : "destructive"}>
                  <AlertDescription>
                    {assignmentResult.message || assignmentResult.error}
                    {assignmentResult.success && assignmentResult.invalid_codes?.length > 0 && (
                      <div className="mt-2">
                        <strong>Invalid codes:</strong> {assignmentResult.invalid_codes.join(', ')}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Worker Areas Display */}
          {selectedWorker && workerAreas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Current Worker Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workerAreas.map((area, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="space-y-1">
                        <div className="font-medium">{area.area_name}</div>
                        <div className="text-sm text-gray-600">
                          ZCTA: {area.zcta_code} | {area.zcta_validation.city}, {area.zcta_validation.state}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getDataSourceBadge(area.zcta_validation.data_source)}
                        <Badge variant={area.is_active ? "default" : "secondary"}>
                          {area.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Booking Details Tab */}
        <TabsContent value="booking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter booking ID"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                />
                <Button 
                  onClick={getBookingDetails}
                  disabled={bookingLoading || !bookingId.trim()}
                >
                  {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Get Details
                </Button>
              </div>

              {bookingDetails && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Booking Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Customer:</strong> {bookingDetails.customer_name}</div>
                      <div><strong>ZCTA Code:</strong> {bookingDetails.customer_zcta_code}</div>
                      <div><strong>Location:</strong> {bookingDetails.customer_city}, {bookingDetails.customer_state}</div>
                      <div><strong>Date:</strong> {bookingDetails.scheduled_date} at {bookingDetails.scheduled_start}</div>
                      <div><strong>Status:</strong> 
                        <Badge className="ml-2" variant={
                          bookingDetails.assignment_status === 'assigned' ? 'default' : 
                          bookingDetails.assignment_status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {bookingDetails.assignment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {bookingDetails.worker_name && (
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-3">Worker Assignment</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Worker:</strong> {bookingDetails.worker_name}</div>
                        <div><strong>Area:</strong> {bookingDetails.area_name}</div>
                        <div><strong>Email:</strong> {bookingDetails.worker_email}</div>
                        <div><strong>Phone:</strong> {bookingDetails.worker_phone}</div>
                      </div>
                    </div>
                  )}

                  {bookingDetails.zcta_validation && (
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-3">ZCTA Validation</h3>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <strong>Data Source:</strong> {getDataSourceBadge(bookingDetails.zcta_validation.data_source)}
                        </div>
                        <div className="text-sm">
                          <strong>Area:</strong> {bookingDetails.zcta_validation.total_area_sq_miles} sq mi
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Analysis Tab */}
        <TabsContent value="coverage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Coverage analysis features coming soon...</p>
                <p className="text-sm">Will include maps, charts, and expansion recommendations</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
