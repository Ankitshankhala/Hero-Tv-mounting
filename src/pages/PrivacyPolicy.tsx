import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Phone, Mail, MapPin, CreditCard, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SEO } from '@/components/SEO';
import { Footer } from '@/components/Footer';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <SEO 
        title="Privacy Policy | Hero TV Mounting"
        description="Learn how Hero TV Mounting collects, uses, and protects your personal information."
      />
      
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
              <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
              <p className="text-slate-300">Last updated: December 2024</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Introduction */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-400" />
                Introduction
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                Hero TV Mounting ("we," "us," or "our") is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our services.
              </p>
              <p>
                By using our services, you agree to the collection and use of information in 
                accordance with this policy.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>We collect information you provide directly to us, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li className="flex items-start gap-2">
                  <span>
                    <strong className="text-white">Contact Information:</strong> Name, email address, 
                    phone number, and service address
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>
                    <strong className="text-white">Booking Information:</strong> Service requests, 
                    scheduling preferences, and special instructions
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>
                    <strong className="text-white">Payment Information:</strong> Payment card details 
                    (processed securely by Stripe)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>
                    <strong className="text-white">Location Data:</strong> ZIP code and service address 
                    to match you with available technicians
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* SMS Notifications - Key Section */}
          <Card className="bg-slate-800 border-slate-700 ring-2 ring-blue-500/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-400" />
                SMS Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                We collect your phone number to send transactional SMS notifications to keep you 
                informed about your service. These notifications may include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Booking confirmations</strong> - Confirmation of your scheduled service</li>
                <li><strong className="text-white">Technician arrival updates</strong> - When your technician is on the way</li>
                <li><strong className="text-white">Schedule changes</strong> - Any changes to your appointment time</li>
                <li><strong className="text-white">Invoices and receipts</strong> - Payment confirmations and invoices</li>
                <li><strong className="text-white">Service reminders</strong> - Upcoming appointment reminders</li>
              </ul>
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mt-4">
                <p className="text-blue-200">
                  <strong>Opt-out:</strong> You can opt-out of SMS notifications at any time by 
                  replying <span className="font-mono bg-blue-800/50 px-2 py-0.5 rounded">STOP</span> to 
                  any message you receive from us.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Process and fulfill your service requests</li>
                <li>Communicate with you about bookings, services, and updates</li>
                <li>Send transactional SMS and email notifications</li>
                <li>Process payments securely</li>
                <li>Match you with available technicians in your area</li>
                <li>Improve our services and customer experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Sharing */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Information Sharing</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>We may share your information with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-white">Service Technicians:</strong> Your name, address, 
                  phone number, and service details to complete your booking
                </li>
                <li>
                  <strong className="text-white">Payment Processors:</strong> Stripe processes all 
                  payment transactions securely
                </li>
                <li>
                  <strong className="text-white">Communication Services:</strong> Third-party services 
                  that help us send SMS and email notifications
                </li>
              </ul>
              <p className="mt-4">
                We do not sell your personal information to third parties.
              </p>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-400" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                We implement appropriate technical and organizational measures to protect your 
                personal information, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure payment processing through PCI-compliant Stripe</li>
                <li>Access controls and authentication measures</li>
                <li>Regular security assessments</li>
              </ul>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Opt-out of SMS notifications by replying STOP</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </CardContent>
          </Card>

          {/* Contact Us */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-400" />
                Contact Us
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                If you have any questions about this Privacy Policy or our data practices, 
                please contact us:
              </p>
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-400" />
                  <a href="tel:+15752088997" className="text-blue-400 hover:text-blue-300">
                    (575) 208-8997
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  <a href="mailto:support@herotvmounting.com" className="text-blue-400 hover:text-blue-300">
                    support@herotvmounting.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Policy */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any 
                changes by posting the new Privacy Policy on this page and updating the "Last 
                updated" date at the top of this policy.
              </p>
            </CardContent>
          </Card>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
