
-- Clear existing services and insert the complete list from the landing page
DELETE FROM services;

-- Insert all services from the landing page with correct pricing
INSERT INTO services (name, description, base_price, duration_minutes) VALUES
('TV Mounting', 'Professional TV wall mounting with perfect positioning', 90.00, 60),
('Full Motion Mount', 'Articulating mount for maximum flexibility', 80.00, 45),
('Flat Mount', 'Low-profile flat wall mount', 50.00, 30),
('Cover Cables', 'Clean cable management with decorative covers', 20.00, 15),
('Simple Cable Concealment', 'Basic in-wall cable concealment', 50.00, 30),
('Fire Safe Cable Concealment', 'Fire-rated in-wall cable concealment system', 100.00, 45),
('General Mounting', 'General mounting services per hour', 75.00, 60),
('Furniture Assembly', 'Professional furniture assembly per hour', 50.00, 60),
('Hire Second Technician', 'Additional technician for complex installations', 65.00, 60),
('Over 65" TV Add-on', 'Additional charge for TVs over 65 inches', 25.00, 15),
('Frame Mount Add-on', 'Specialized frame mounting service', 25.00, 15),
('Stone/Brick/Tile Wall', 'Additional charge for mounting on stone, brick, or tile walls', 50.00, 30);
