import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, CreditCard, Clock, AlertCircle, Users, Phone, Scale, Building, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import SEO from '@/components/SEO';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-slate-900">
      <SEO 
        title="Terms of Service | Hero TV Mounting"
        description="Read the terms and conditions for using Hero TV Mounting services. Understand our booking, payment, cancellation, and service policies."
      />
      
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-slate-400 mt-2">Last updated: December 12, 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        
        {/* Introduction */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-blue-400" />
              Agreement to Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>
              Welcome to Hero TV Mounting. By accessing our website, booking our services, or using any part of our platform, 
              you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our services.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you ("Customer," "you," or "your") and Hero TV Mounting 
              ("Company," "we," "us," or "our") governing your use of our TV mounting and installation services.
            </p>
          </CardContent>
        </Card>

        {/* Services Description */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building className="w-5 h-5 text-green-400" />
              Services Description
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>Hero TV Mounting provides professional TV mounting and installation services, including but not limited to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>TV wall mounting (standard, tilting, and full-motion mounts)</li>
              <li>Soundbar installation</li>
              <li>Cable management and concealment</li>
              <li>Power outlet relocation assistance</li>
              <li>Related home entertainment installation services</li>
            </ul>
            <p>
              <strong className="text-white">Service Area:</strong> Our services are currently available in select areas of Texas. 
              Service availability is determined by ZIP code at the time of booking.
            </p>
          </CardContent>
        </Card>

        {/* Booking & Scheduling */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-purple-400" />
              Booking & Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">Booking Process</h4>
              <p>
                When you book a service through our platform, you are requesting an appointment with one of our professional technicians. 
                Bookings are subject to availability and confirmation.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Appointment Windows</h4>
              <p>
                We provide estimated arrival windows for our technicians. While we strive to arrive within the scheduled window, 
                delays may occur due to traffic, previous appointments, or unforeseen circumstances. We will notify you of any significant delays.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Access Requirements</h4>
              <p>
                You must ensure that an authorized adult (18 years or older) is present at the service location during the scheduled appointment. 
                If no one is available to provide access, the appointment may be marked as a no-show and fees may apply.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Payment */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5 text-yellow-400" />
              Pricing & Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">Service Pricing</h4>
              <p>
                Prices displayed during booking are estimates based on the information you provide. Final pricing may vary based on 
                actual conditions at the service location, additional services requested, or unforeseen complications.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Payment Authorization</h4>
              <p>
                When you book a service, we authorize your payment method for the estimated amount. Your card is <strong className="text-white">not charged</strong> until 
                the service is completed to your satisfaction. We use Stripe for secure payment processing.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Tipping</h4>
              <p>
                Tips are optional and greatly appreciated by our technicians. You may add a tip during checkout or after service completion. 
                100% of tips go directly to the technician who performed your service.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Taxes</h4>
              <p>
                Applicable state and local taxes will be added to your service total based on your service location.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Responsibilities */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-cyan-400" />
              Customer Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>By using our services, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate information about your service location, TV specifications, and wall conditions</li>
              <li>Ensure clear access to the work area and remove any obstacles</li>
              <li>Disclose any known issues with walls (studs, wiring, plumbing locations)</li>
              <li>Be present or have an authorized adult present during the service</li>
              <li>Ensure pets are secured during the technician's visit</li>
              <li>Provide a safe working environment for our technicians</li>
              <li>Pay for any additional services or materials agreed upon during the appointment</li>
            </ul>
          </CardContent>
        </Card>

        {/* Service Guarantees */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-emerald-400" />
              Service Guarantees & Limitations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">Quality Guarantee</h4>
              <p>
                We stand behind our workmanship. If you're not satisfied with the installation quality, contact us within 30 days 
                and we will send a technician to address any issues at no additional charge.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Limitation of Liability</h4>
              <p>
                Hero TV Mounting's liability is limited to the cost of the services provided. We are not responsible for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Pre-existing damage to walls, TVs, or other equipment</li>
                <li>Damage caused by improper wall construction or hidden hazards</li>
                <li>Issues arising from customer-provided equipment or mounts</li>
                <li>Damage resulting from customer modifications after service completion</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Insurance</h4>
              <p>
                Our technicians are fully insured. In the rare event of accidental damage during service, please report it immediately 
                to our technician and contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cancellation & Refunds */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <RefreshCw className="w-5 h-5 text-orange-400" />
              Cancellation & Refund Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">Cancellation by Customer</h4>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">More than 24 hours before appointment:</strong> Free cancellation, full refund of any deposits</li>
                <li><strong className="text-white">Less than 24 hours before appointment:</strong> A cancellation fee may apply</li>
                <li><strong className="text-white">No-show:</strong> If you are not available at the scheduled time without prior notice, you may be charged a no-show fee</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Cancellation by Company</h4>
              <p>
                We reserve the right to cancel or reschedule appointments due to technician availability, weather conditions, 
                or safety concerns. In such cases, you will receive a full refund or the option to reschedule at no additional cost.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Refund Process</h4>
              <p>
                Approved refunds are processed within 5-10 business days and returned to the original payment method.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Communication Consent */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Phone className="w-5 h-5 text-pink-400" />
              Communication Consent
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>
              By providing your phone number and email address, you consent to receive:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Booking confirmations and reminders</li>
              <li>Technician arrival notifications</li>
              <li>Schedule changes and updates</li>
              <li>Invoices and receipts</li>
              <li>Service-related communications</li>
            </ul>
            <p>
              You can opt-out of SMS notifications at any time by replying STOP to any message. 
              For more information, please see our <Link to="/privacy-policy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
            </p>
          </CardContent>
        </Card>

        {/* Dispute Resolution */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Scale className="w-5 h-5 text-indigo-400" />
              Dispute Resolution & Governing Law
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2">Dispute Resolution</h4>
              <p>
                If you have any concerns or disputes regarding our services, please contact our customer support team first. 
                We are committed to resolving issues promptly and fairly.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Governing Law</h4>
              <p>
                These Terms are governed by and construed in accordance with the laws of the State of Texas, 
                without regard to its conflict of law provisions. Any disputes arising from these Terms or our services 
                shall be subject to the exclusive jurisdiction of the courts located in Texas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <ul className="space-y-2 ml-4">
              <li><strong className="text-white">Email:</strong> support@herotvmounting.com</li>
              <li><strong className="text-white">Phone:</strong> (555) 123-4567</li>
              <li><strong className="text-white">Hours:</strong> Monday - Saturday, 8:00 AM - 8:00 PM CT</li>
            </ul>
          </CardContent>
        </Card>

        {/* Changes to Terms */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Changes to These Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300">
            <p>
              We reserve the right to update or modify these Terms at any time. Changes will be effective immediately upon posting 
              to our website. Your continued use of our services after any changes indicates your acceptance of the updated Terms. 
              We encourage you to review these Terms periodically.
            </p>
          </CardContent>
        </Card>

      </div>

      <Footer />
    </div>
  );
};

export default TermsOfService;
