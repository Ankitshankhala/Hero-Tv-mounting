-- Create US ZIP codes table for accurate city/state lookup
CREATE TABLE IF NOT EXISTS public.us_zip_codes (
  zipcode TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert sample ZIP codes (Fort Worth and Dallas area)
INSERT INTO public.us_zip_codes (zipcode, city, state, state_abbr, latitude, longitude) VALUES
('76101', 'Fort Worth', 'Texas', 'TX', 32.7555, -97.3308),
('76102', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.3364),
('76103', 'Fort Worth', 'Texas', 'TX', 32.7218, -97.3364),
('76104', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.3531),
('76105', 'Fort Worth', 'Texas', 'TX', 32.6957, -97.3531),
('76106', 'Fort Worth', 'Texas', 'TX', 32.7218, -97.3698),
('76107', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.3698),
('76108', 'Fort Worth', 'Texas', 'TX', 32.6957, -97.3698),
('76109', 'Fort Worth', 'Texas', 'TX', 32.7555, -97.3865),
('76110', 'Fort Worth', 'Texas', 'TX', 32.6757, -97.3531),
('76111', 'Fort Worth', 'Texas', 'TX', 32.7954, -97.3031),
('76112', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.2697),
('76113', 'Fort Worth', 'Texas', 'TX', 32.6957, -97.2697),
('76114', 'Fort Worth', 'Texas', 'TX', 32.6557, -97.3364),
('76115', 'Fort Worth', 'Texas', 'TX', 32.6757, -97.3865),
('76116', 'Fort Worth', 'Texas', 'TX', 32.6357, -97.3698),
('76117', 'Fort Worth', 'Texas', 'TX', 32.7954, -97.3698),
('76118', 'Fort Worth', 'Texas', 'TX', 32.8153, -97.3531),
('76119', 'Fort Worth', 'Texas', 'TX', 32.6957, -97.3198),
('76120', 'Fort Worth', 'Texas', 'TX', 32.6557, -97.2864),
('76121', 'Fort Worth', 'Texas', 'TX', 32.6357, -97.3198),
('76122', 'Fort Worth', 'Texas', 'TX', 32.6757, -97.2530),
('76123', 'Fort Worth', 'Texas', 'TX', 32.6157, -97.3031),
('76124', 'Fort Worth', 'Texas', 'TX', 32.5957, -97.3531),
('76126', 'Fort Worth', 'Texas', 'TX', 32.5757, -97.4032),
('76127', 'Fort Worth', 'Texas', 'TX', 32.7555, -97.4199),
('76129', 'Fort Worth', 'Texas', 'TX', 32.5557, -97.3698),
('76131', 'Fort Worth', 'Texas', 'TX', 32.6957, -97.4199),
('76132', 'Fort Worth', 'Texas', 'TX', 32.6757, -97.4533),
('76133', 'Fort Worth', 'Texas', 'TX', 32.6357, -97.4366),
('76134', 'Fort Worth', 'Texas', 'TX', 32.6157, -97.3531),
('76135', 'Fort Worth', 'Texas', 'TX', 32.5757, -97.3198),
('76137', 'Fort Worth', 'Texas', 'TX', 32.8553, -97.3198),
('76140', 'Fort Worth', 'Texas', 'TX', 32.6757, -97.2197),
('76147', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.4700),
('76148', 'Fort Worth', 'Texas', 'TX', 32.8753, -97.3531),
('76161', 'Fort Worth', 'Texas', 'TX', 32.5357, -97.2697),
('76162', 'Fort Worth', 'Texas', 'TX', 32.4957, -97.3198),
('76163', 'Fort Worth', 'Texas', 'TX', 32.4757, -97.2864),
('76164', 'Fort Worth', 'Texas', 'TX', 32.5157, -97.3698),
('76177', 'Fort Worth', 'Texas', 'TX', 32.5757, -97.2197),
('76179', 'Fort Worth', 'Texas', 'TX', 32.5157, -97.2530),
('76180', 'Fort Worth', 'Texas', 'TX', 32.8353, -97.2364),
('76181', 'Fort Worth', 'Texas', 'TX', 32.8753, -97.2697),
('76182', 'Fort Worth', 'Texas', 'TX', 32.8953, -97.3031),
('76185', 'Fort Worth', 'Texas', 'TX', 32.4757, -97.3364),
('76191', 'Fort Worth', 'Texas', 'TX', 32.5957, -97.2864),
('76192', 'Fort Worth', 'Texas', 'TX', 32.4557, -97.3031),
('76193', 'Fort Worth', 'Texas', 'TX', 32.9353, -97.3031),
('76195', 'Fort Worth', 'Texas', 'TX', 32.4357, -97.3531),
('76196', 'Fort Worth', 'Texas', 'TX', 32.4157, -97.2864),
('76197', 'Fort Worth', 'Texas', 'TX', 32.4357, -97.2364),
('76199', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.3198),
('75001', 'Addison', 'Texas', 'TX', 32.9637, -96.8364),
('75002', 'Allen', 'Texas', 'TX', 33.1031, -96.6706),
('75006', 'Carrollton', 'Texas', 'TX', 32.9537, -96.8900),
('75007', 'Carrollton', 'Texas', 'TX', 32.9537, -96.8900),
('75010', 'Carrollton', 'Texas', 'TX', 32.9537, -96.8900),
('75019', 'Coppell', 'Texas', 'TX', 32.9546, -97.0150),
('75020', 'Denison', 'Texas', 'TX', 33.7557, -96.5364),
('75021', 'Denton', 'Texas', 'TX', 33.2148, -97.1331),
('75022', 'Flower Mound', 'Texas', 'TX', 33.0148, -97.0967),
('75023', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75024', 'Plano', 'Texas', 'TX', 33.0937, -96.8364),
('75025', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75026', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75030', 'Rowlett', 'Texas', 'TX', 32.9029, -96.5364),
('75034', 'Frisco', 'Texas', 'TX', 33.1507, -96.8236),
('75035', 'Frisco', 'Texas', 'TX', 33.1507, -96.8236),
('75040', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75041', 'Garland', 'Texas', 'TX', 33.0354, -96.7092),
('75042', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75043', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75044', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75045', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75046', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75047', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75048', 'Sachse', 'Texas', 'TX', 32.9776, -96.5908),
('75049', 'Garland', 'Texas', 'TX', 32.9126, -96.6389),
('75050', 'Grand Prairie', 'Texas', 'TX', 32.7459, -96.9978),
('75051', 'Grand Prairie', 'Texas', 'TX', 32.7459, -96.9978),
('75052', 'Grand Prairie', 'Texas', 'TX', 32.7459, -96.9978),
('75054', 'Grand Prairie', 'Texas', 'TX', 32.7459, -96.9978),
('75056', 'The Colony', 'Texas', 'TX', 33.0890, -96.8989),
('75060', 'Irving', 'Texas', 'TX', 32.8140, -96.9489),
('75061', 'Irving', 'Texas', 'TX', 32.8140, -96.9489),
('75062', 'Irving', 'Texas', 'TX', 32.8140, -96.9489),
('75063', 'Irving', 'Texas', 'TX', 32.8140, -96.9489),
('75067', 'Lewisville', 'Texas', 'TX', 33.0462, -97.0067),
('75068', 'Little Elm', 'Texas', 'TX', 33.1626, -96.9375),
('75069', 'McKinney', 'Texas', 'TX', 33.1972, -96.6150),
('75070', 'McKinney', 'Texas', 'TX', 33.1972, -96.6150),
('75071', 'McKinney', 'Texas', 'TX', 33.1972, -96.6150),
('75072', 'McKinney', 'Texas', 'TX', 33.1972, -96.6150),
('75074', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75075', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75077', 'Lewisville', 'Texas', 'TX', 33.0462, -97.0067),
('75078', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75080', 'Richardson', 'Texas', 'TX', 32.9484, -96.7297),
('75081', 'Richardson', 'Texas', 'TX', 32.9484, -96.7297),
('75082', 'Richardson', 'Texas', 'TX', 32.9484, -96.7297),
('75083', 'Richardson', 'Texas', 'TX', 32.9484, -96.7297),
('75085', 'Richardson', 'Texas', 'TX', 32.9484, -96.7297),
('75086', 'Rockwall', 'Texas', 'TX', 32.9318, -96.4597),
('75087', 'Rockwall', 'Texas', 'TX', 32.9318, -96.4597),
('75088', 'Rowlett', 'Texas', 'TX', 32.9029, -96.5364),
('75089', 'Rowlett', 'Texas', 'TX', 32.9029, -96.5364),
('75090', 'Sherman', 'Texas', 'TX', 33.6357, -96.6089),
('75093', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75094', 'Plano', 'Texas', 'TX', 33.0198, -96.6989),
('75098', 'Wylie', 'Texas', 'TX', 33.0151, -96.5389),
('75101', 'Bardwell', 'Texas', 'TX', 32.2657, -96.6900),
('75102', 'Barry', 'Texas', 'TX', 32.0954, -96.6364),
('75103', 'Cedar Hill', 'Texas', 'TX', 32.5885, -96.9561),
('75104', 'Cedar Hill', 'Texas', 'TX', 32.5885, -96.9561),
('75106', 'Combine', 'Texas', 'TX', 32.5957, -96.5364),
('75109', 'Corsicana', 'Texas', 'TX', 32.0954, -96.4689),
('75110', 'Corsicana', 'Texas', 'TX', 32.0954, -96.4689),
('75115', 'Desoto', 'Texas', 'TX', 32.5890, -96.8570),
('75116', 'Duncanville', 'Texas', 'TX', 32.6518, -96.9078),
('75118', 'Duncanville', 'Texas', 'TX', 32.6518, -96.9078),
('75119', 'Duncanville', 'Texas', 'TX', 32.6518, -96.9078),
('75120', 'Cedar Hill', 'Texas', 'TX', 32.5885, -96.9561),
('75121', 'Hutchins', 'Texas', 'TX', 32.6418, -96.7078),
('75125', 'Ferris', 'Texas', 'TX', 32.5357, -96.6689),
('75126', 'Forney', 'Texas', 'TX', 32.7490, -96.4708),
('75134', 'Lancaster', 'Texas', 'TX', 32.5918, -96.7561),
('75137', 'Lancaster', 'Texas', 'TX', 32.5918, -96.7561),
('75138', 'Duncanville', 'Texas', 'TX', 32.6518, -96.9078),
('75140', 'Kemp', 'Texas', 'TX', 32.4426, -96.2286),
('75141', 'Hutchins', 'Texas', 'TX', 32.6418, -96.7078),
('75142', 'Kaufman', 'Texas', 'TX', 32.5890, -96.3089),
('75146', 'Lancaster', 'Texas', 'TX', 32.5918, -96.7561),
('75147', 'Lancaster', 'Texas', 'TX', 32.5918, -96.7561),
('75148', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75149', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75150', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75152', 'Palmer', 'Texas', 'TX', 32.4640, -96.6797),
('75154', 'Red Oak', 'Texas', 'TX', 32.5218, -96.8061),
('75157', 'Rosser', 'Texas', 'TX', 32.4415, -96.4658),
('75159', 'Seagoville', 'Texas', 'TX', 32.6890, -96.5378),
('75172', 'Wilmer', 'Texas', 'TX', 32.5918, -96.6811),
('75180', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75181', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75182', 'Sunnyvale', 'Texas', 'TX', 32.7968, -96.5578),
('75185', 'Mesquite', 'Texas', 'TX', 32.7668, -96.5992),
('75187', 'Waxahachie', 'Texas', 'TX', 32.3865, -96.8489),
('75189', 'Royse City', 'Texas', 'TX', 32.9754, -96.3283),
('75201', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75202', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75203', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75204', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75205', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75206', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75207', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75208', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75209', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75210', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75211', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75212', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75214', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75215', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75216', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75217', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75218', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75219', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75220', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75221', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75222', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75223', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75224', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75225', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75226', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75227', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75228', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75229', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75230', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75231', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75232', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75233', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75234', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75235', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75236', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75237', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75238', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75240', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75241', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75243', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75244', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75246', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75247', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75248', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75249', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75250', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75251', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75252', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75253', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75254', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75260', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75261', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75262', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75263', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75264', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75265', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75266', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75267', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75270', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75275', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75277', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75283', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75284', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75285', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75287', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75295', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75301', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75303', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75310', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75312', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75313', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75315', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75320', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75323', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75326', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75336', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75339', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75342', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75354', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75355', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75356', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75357', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75359', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75360', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75363', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75364', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75367', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75368', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75370', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75371', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75372', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75373', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75374', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75376', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75378', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75379', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75380', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75381', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75382', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75386', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75387', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75388', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75389', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75390', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75391', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75392', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75393', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75394', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75395', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75396', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75397', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75398', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970)
ON CONFLICT (zipcode) DO NOTHING;

-- Update get_zipcode_location_data to use the new table
CREATE OR REPLACE FUNCTION public.get_zipcode_location_data(p_zipcode text)
RETURNS TABLE(city text, state text, state_abbr text, latitude numeric, longitude numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    z.city,
    z.state, 
    z.state_abbr,
    z.latitude,
    z.longitude
  FROM public.us_zip_codes z
  WHERE z.zipcode = p_zipcode;
END;
$function$;

-- Function to check if ZIP has active worker coverage
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage_by_zip(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.worker_service_zipcodes wsz
    INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN public.users u ON wsz.worker_id = u.id
    WHERE wsz.zipcode = p_zipcode
      AND wsa.is_active = true
      AND u.role = 'worker'
      AND u.is_active = true
  );
END;
$function$;

-- Function to get worker count by ZIP code
CREATE OR REPLACE FUNCTION public.get_worker_count_by_zip(p_zipcode text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  worker_count integer;
BEGIN
  SELECT COUNT(DISTINCT wsz.worker_id)
  INTO worker_count
  FROM public.worker_service_zipcodes wsz
  INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN public.users u ON wsz.worker_id = u.id
  WHERE wsz.zipcode = p_zipcode
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true;
    
  RETURN COALESCE(worker_count, 0);
END;
$function$;