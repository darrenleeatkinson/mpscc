-- Static reference data: 40 crime types, 4 shift patterns, skills catalogue.

INSERT INTO shift_patterns (code, start_time, duration_h) VALUES
  ('EARLY','06:00',10), ('DAY','10:00',10), ('LATE','16:00',10), ('NIGHT','22:00',10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO skills (code, name, category) VALUES
  ('FIREARMS','Firearms (AFO)','TACTICAL'),
  ('ADVANCED_DRIVER','Advanced Driver','DRIVING'),
  ('DETECTIVE','Detective','INVESTIGATIVE'),
  ('SENIOR_DETECTIVE','Senior Detective','INVESTIGATIVE'),
  ('MURDER_INVESTIGATION','Murder Investigation','INVESTIGATIVE'),
  ('DOG_HANDLER','Dog Handler','SPECIALIST'),
  ('MOUNTED','Mounted','SPECIALIST'),
  ('PUBLIC_ORDER','Public Order','TACTICAL'),
  ('TRAFFIC','Traffic','SPECIALIST'),
  ('NEGOTIATOR','Negotiator','SPECIALIST'),
  ('MEDICAL_FIRST_AID','Medical First Aid','SPECIALIST'),
  ('CBRN','CBRN','TACTICAL'),
  ('SURVEILLANCE','Surveillance','INVESTIGATIVE'),
  ('CYBER','Cyber','INVESTIGATIVE'),
  ('CHILD_PROTECTION','Child Protection','INVESTIGATIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO crime_types (code, name, category, default_priority) VALUES
  ('MURDER','Murder','Serious violence',1),
  ('ATTEMPTED_MURDER','Attempted murder','Serious violence',1),
  ('MANSLAUGHTER','Manslaughter','Serious violence',1),
  ('GBH','Grievous bodily harm (wounding)','Violence',1),
  ('ABH','Actual bodily harm','Violence',2),
  ('COMMON_ASSAULT','Common assault','Violence',3),
  ('RAPE','Rape','Sexual offences',1),
  ('SEXUAL_ASSAULT','Sexual assault','Sexual offences',1),
  ('KIDNAP','Kidnapping / false imprisonment','Serious violence',1),
  ('ARMED_ROBBERY','Robbery (armed)','Robbery',1),
  ('ROBBERY','Robbery (personal)','Robbery',2),
  ('AGG_BURGLARY','Aggravated burglary','Burglary',1),
  ('BURGLARY_DWELLING','Burglary — residential','Burglary',2),
  ('BURGLARY_COMMERCIAL','Burglary — commercial','Burglary',3),
  ('FIREARMS_INCIDENT','Firearms discharge / person with gun','Weapons',1),
  ('KNIFE_CRIME','Knife crime / person with blade','Weapons',1),
  ('TERRORISM_SUSPECT','Suspected terrorism','Counter-terror',1),
  ('ARSON','Arson','Criminal damage',1),
  ('HOSTAGE','Hostage situation','Serious violence',1),
  ('DOMESTIC_ABUSE','Domestic abuse (in progress)','Violence',1),
  ('CHILD_ABUSE','Child abuse / safeguarding','Safeguarding',1),
  ('MISSING_PERSON_HR','Missing person — high risk','Safeguarding',1),
  ('MISSING_PERSON','Missing person — standard','Safeguarding',3),
  ('RTC_INJURY','Road traffic collision — injury','Road',1),
  ('RTC_DAMAGE','Road traffic collision — damage only','Road',3),
  ('DANGEROUS_DRIVING','Dangerous / careless driving','Road',2),
  ('DRINK_DRIVING','Driving under influence','Road',2),
  ('DRUG_DEALING','Drug dealing / supply','Drugs',3),
  ('DRUG_POSSESSION','Drug possession','Drugs',4),
  ('ASSAULT_POLICE','Assault on emergency worker','Violence',2),
  ('PUBLIC_ORDER','Public order / affray','Public order',2),
  ('DRUNK_DISORDERLY','Drunk and disorderly','Public order',4),
  ('ASB','Anti-social behaviour','Public order',4),
  ('THEFT_PERSON','Theft from the person / pickpocketing','Theft',3),
  ('SHOPLIFTING','Shoplifting','Theft',4),
  ('VEHICLE_THEFT','Theft of motor vehicle','Theft',3),
  ('THEFT_FROM_VEHICLE','Theft from motor vehicle','Theft',4),
  ('CRIMINAL_DAMAGE','Criminal damage / vandalism','Criminal damage',4),
  ('FRAUD','Fraud','Economic',5),
  ('HARASSMENT','Harassment / malicious comms','Violence',4)
ON CONFLICT (code) DO NOTHING;
