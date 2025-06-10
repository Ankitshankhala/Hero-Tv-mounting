
# Hero TV Mounting

A comprehensive TV mounting service platform built for professionals and customers. This full-stack web application provides seamless booking management, worker dashboards, customer portals, and administrative tools for a TV mounting service business.

## 🚀 Features

### Customer Features
- **Service Selection**: Choose from various TV mounting and cable concealment services
- **Interactive Booking**: Dynamic pricing with real-time cart updates
- **Customizable Options**: Configure mounting options (over 65", frame mounts, cable concealment, etc.)
- **Secure Checkout**: Integrated Stripe payment processing
- **Booking Management**: Track and manage service appointments

### Worker Features
- **Worker Dashboard**: Comprehensive job management interface
- **Job Calendar**: Visual calendar view of scheduled appointments
- **Booking Creation**: Create bookings for customers directly
- **Job Actions**: Start, complete, and manage job status
- **On-site Charges**: Process additional charges during service
- **Invoice Modifications**: Modify service details and pricing
- **Schedule Management**: Set availability and working hours

### Admin Features
- **Complete Dashboard**: Overview of business metrics and KPIs
- **User Management**: Manage workers, customers, and applications
- **Booking Management**: View, assign, and manage all bookings
- **Service Management**: Configure services, pricing, and availability
- **Payment Tracking**: Monitor transactions and payment status
- **SMS Notifications**: Automated SMS alerts for workers and customers
- **Review Management**: Handle customer reviews and ratings
- **Worker Applications**: Process and approve new worker applications

### Additional Features
- **Multi-role Authentication**: Secure login for customers, workers, and admins
- **Real-time Updates**: Live status updates across the platform
- **Responsive Design**: Mobile-first design that works on all devices
- **Geographic Features**: Location-based worker assignment
- **Review System**: Customer ratings and photo reviews
- **Blog Integration**: Content management for SEO and customer education

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for responsive styling
- **Shadcn/UI** for consistent component library
- **React Router** for client-side routing
- **TanStack Query** for data fetching and caching
- **Lucide React** for icons
- **Recharts** for data visualization

### Backend & Database
- **Supabase** for backend-as-a-service
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions
  - Authentication and user management
  - Edge functions for server-side logic
  - File storage capabilities

### Payment Processing
- **Stripe** integration for secure payments
- **Checkout Sessions** for one-time payments
- **Payment Intent** for on-site charges

### Communication
- **Twilio SMS** for automated notifications
- Email notifications for important updates

## 📂 Project Structure

```
hero-tv-mounting/
├── public/                     # Static assets and uploads
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── admin/            # Admin-specific components
│   │   ├── auth/             # Authentication components
│   │   ├── ui/               # Base UI components (Shadcn)
│   │   └── worker/           # Worker dashboard components
│   ├── hooks/                # Custom React hooks
│   ├── integrations/         # External service integrations
│   │   └── supabase/        # Supabase client and types
│   ├── lib/                  # Utility functions
│   ├── pages/                # Page components
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Helper functions
├── supabase/
│   ├── functions/            # Edge functions
│   ├── migrations/           # Database migrations
│   └── config.toml          # Supabase configuration
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account
- Stripe account (for payments)
- Twilio account (for SMS notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hero-tv-mounting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run the database migrations from `supabase/migrations/`
   - Configure authentication providers
   - Set up environment variables

4. **Configure Environment Variables**
   Set up the following secrets in your Supabase project:
   - `STRIPE_SECRET_KEY` - Your Stripe secret key
   - `TWILIO_ACCOUNT_SID` - Twilio account SID
   - `TWILIO_AUTH_TOKEN` - Twilio auth token
   - `TWILIO_PHONE_NUMBER` - Twilio phone number

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🔐 Authentication & Roles

The application supports three user roles:

- **Customer**: Can book services and manage their appointments
- **Worker**: Can view assigned jobs, manage schedules, and process payments
- **Admin**: Has full access to all system features and management tools

## 📊 Database Schema

### Core Tables
- `users` - User profiles and authentication
- `bookings` - Service appointments and details
- `services` - Available services and pricing
- `reviews` - Customer reviews and ratings
- `transactions` - Payment records
- `worker_schedules` - Worker availability
- `sms_logs` - SMS notification history

### Key Features
- **Row Level Security (RLS)** for data protection
- **Real-time subscriptions** for live updates
- **JSONB fields** for flexible service configurations
- **Geographic data** for location-based features

## 🔧 Deployment

### Supabase Edge Functions
The project includes several edge functions for server-side operations:
- Payment processing with Stripe
- SMS notifications via Twilio
- Booking management and worker assignment
- Late fee calculations

### Production Deployment
1. Build the application: `npm run build`
2. Deploy edge functions to Supabase
3. Configure production environment variables
4. Set up custom domain (optional)

## 📱 Mobile Responsiveness

The application is fully responsive and optimized for:
- Desktop computers
- Tablets
- Mobile phones
- Touch interfaces

## 🔒 Security Features

- **Row Level Security (RLS)** on all database tables
- **JWT token authentication** via Supabase
- **Role-based access control** (RBAC)
- **Secure payment processing** with Stripe
- **Data validation** on both client and server

## 📞 Support & Contact

- **Business Phone**: +1 737-272-9971
- **Service Area**: Texas and surrounding regions
- **Business Hours**: Check worker availability

## 🏗️ Built By

**Charu Solutions** - Professional web development services

---

## 📝 License

This project is proprietary software developed for Hero TV Mounting services.

## 🤝 Contributing

This is a private business application. For development inquiries, please contact Charu Solutions.
