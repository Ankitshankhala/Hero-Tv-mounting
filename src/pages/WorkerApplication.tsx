import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const WorkerApplication = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    region: '',
    experience: '',
    skills: '',
    availability: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    hasVehicle: false,
    hasTools: false,
    backgroundCheck: false,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      availability: { ...prev.availability, [day]: checked }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('worker_applications')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          region: formData.region,
          experience: formData.experience,
          skills: formData.skills,
          availability: formData.availability,
          has_vehicle: formData.hasVehicle,
          has_tools: formData.hasTools,
          background_check_consent: formData.backgroundCheck,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 2-3 business days.",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        city: '',
        region: '',
        experience: '',
        skills: '',
        availability: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
        hasVehicle: false,
        hasTools: false,
        backgroundCheck: false,
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const availableDays = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" className="text-white hover:text-blue-400">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Join Our Team</h1>
              <p className="text-slate-300">Apply to become a TV mounting professional</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Briefcase className="h-6 w-6" />
                <span>Worker Application</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-slate-300">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="New York"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region" className="text-slate-300">Service Region</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => handleInputChange('region', e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Downtown, Manhattan, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience" className="text-slate-300">Experience & Background</Label>
                  <Textarea
                    id="experience"
                    value={formData.experience}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Describe your relevant experience..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills" className="text-slate-300">Skills & Certifications</Label>
                  <Textarea
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => handleInputChange('skills', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="List any relevant skills, certifications, or training..."
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-slate-300">Availability</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availableDays.map((day) => (
                      <div key={day.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={day.key}
                          checked={formData.availability[day.key as keyof typeof formData.availability]}
                          onCheckedChange={(checked) => handleAvailabilityChange(day.key, checked as boolean)}
                        />
                        <Label htmlFor={day.key} className="text-slate-300 text-sm">{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasVehicle"
                      checked={formData.hasVehicle}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasVehicle: checked as boolean }))}
                    />
                    <Label htmlFor="hasVehicle" className="text-slate-300">I have reliable transportation</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasTools"
                      checked={formData.hasTools}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasTools: checked as boolean }))}
                    />
                    <Label htmlFor="hasTools" className="text-slate-300">I have my own tools</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="backgroundCheck"
                      checked={formData.backgroundCheck}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, backgroundCheck: checked as boolean }))}
                      required
                    />
                    <Label htmlFor="backgroundCheck" className="text-slate-300">I consent to a background check</Label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkerApplication;
