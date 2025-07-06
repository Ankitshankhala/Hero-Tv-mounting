
import { useState, useEffect } from 'react';

interface Review {
  id: number | string;
  quote: string;
  rating: number;
  name: string;
  city: string;
  image: string;
}

interface AdminReview {
  id: string;
  customer: string;
  booking: string;
  rating: number;
  title: string;
  comment: string;
  status: 'approved' | 'pending' | 'rejected';
  hasImages: boolean;
  date: string;
  worker: string;
  imageUrl?: string;
}

// This would eventually be replaced with actual API calls
const defaultReviews: Review[] = [
  {
    id: 1,
    quote: "Amazing service! They mounted our 75\" TV perfectly and hid all the cables. The technician was professional and cleaned up after himself. Highly recommend!",
    rating: 5,
    name: "Sarah M.",
    city: "Austin, TX",
    image: "/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png"
  },
  {
    id: 2,
    quote: "Hero TV Mounting saved my living room! What used to be a mess of cables is now a clean, modern entertainment space. The full motion mount is perfect for our sectional.",
    rating: 5,
    name: "Mike R.",
    city: "Dallas, TX",
    image: "/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png"
  },
  {
    id: 3,
    quote: "Professional installation and fair pricing. They even moved our outlet behind the TV so there are zero visible wires. The attention to detail was impressive.",
    rating: 5,
    name: "Jennifer L.",
    city: "Houston, TX",
    image: "/lovable-uploads/4a49b814-b16a-4daf-aa91-3a52fcbb5fae.png"
  },
  {
    id: 4,
    quote: "The team arrived on time and completed the installation quickly. Our 65\" TV looks amazing on the wall and the cable management is flawless. Will definitely use them again!",
    rating: 5,
    name: "David K.",
    city: "San Antonio, TX",
    image: "/lovable-uploads/6889f051-f5b1-4f2a-a093-a09693378bd4.png"
  },
  {
    id: 5,
    quote: "Excellent customer service from start to finish. They explained everything clearly and the final result exceeded our expectations. The TV mounting looks professional and secure.",
    rating: 5,
    name: "Lisa P.",
    city: "Fort Worth, TX",
    image: "/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png"
  }
];

// Global state for unified review management
let globalAdminReviews: Review[] = [];
let globalAdminPanelReviews: AdminReview[] = [
  {
    id: 'REV001',
    customer: 'John Smith',
    booking: 'BK001',
    rating: 5,
    title: 'Excellent service!',
    comment: 'Alex did an amazing job mounting our TV. Very professional and clean work.',
    status: 'approved',
    hasImages: true,
    date: '2024-01-15',
    worker: 'Alex Thompson'
  },
  {
    id: 'REV002',
    customer: 'Sarah Johnson',
    booking: 'BK002',
    rating: 4,
    title: 'Good work',
    comment: 'TV mounted well, but took a bit longer than expected. Overall satisfied.',
    status: 'pending',
    hasImages: false,
    date: '2024-01-14',
    worker: 'Maria Garcia'
  },
  {
    id: 'REV003',
    customer: 'Mike Davis',
    booking: 'BK003',
    rating: 5,
    title: 'Perfect installation',
    comment: 'David was fantastic! Clean cable management and perfect TV placement.',
    status: 'approved',
    hasImages: true,
    date: '2024-01-13',
    worker: 'David Lee'
  },
];

export const useReviewsData = () => {
  const [reviews, setReviews] = useState<Review[]>(defaultReviews);
  const [adminReviews, setAdminReviews] = useState<AdminReview[]>(globalAdminPanelReviews);

  useEffect(() => {
    // Combine default reviews with admin-created reviews
    const allReviews = [...defaultReviews, ...globalAdminReviews];
    setReviews(allReviews);
    setAdminReviews(globalAdminPanelReviews);
  }, []);

  const addAdminReview = (adminReview: any) => {
    const frontendReview: Review = {
      id: `admin-${Date.now()}`,
      quote: adminReview.comment,
      rating: adminReview.rating,
      name: adminReview.customer,
      city: "Admin Added",
      image: adminReview.imageUrl || "/lovable-uploads/30e56e23-dec2-4e93-a794-d7575b2e1bd5.png"
    };
    
    const adminPanelReview: AdminReview = {
      ...adminReview,
      id: `REV${String(globalAdminPanelReviews.length + 1).padStart(3, '0')}`,
    };
    
    // Update both global states
    globalAdminReviews.push(frontendReview);
    globalAdminPanelReviews.push(adminPanelReview);
    
    // Update local states
    setReviews(prev => [frontendReview, ...prev]);
    setAdminReviews(prev => [adminPanelReview, ...prev]);
  };

  const updateAdminReview = (updatedReview: AdminReview) => {
    const index = globalAdminPanelReviews.findIndex(r => r.id === updatedReview.id);
    if (index !== -1) {
      globalAdminPanelReviews[index] = updatedReview;
      setAdminReviews(prev => prev.map(review => 
        review.id === updatedReview.id ? updatedReview : review
      ));
    }
  };

  const deleteAdminReview = (reviewId: string) => {
    globalAdminPanelReviews = globalAdminPanelReviews.filter(r => r.id !== reviewId);
    setAdminReviews(prev => prev.filter(review => review.id !== reviewId));
  };

  return { 
    reviews, 
    adminReviews, 
    addAdminReview, 
    updateAdminReview, 
    deleteAdminReview 
  };
};
