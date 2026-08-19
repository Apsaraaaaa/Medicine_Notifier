"""
Fills the medicine catalog with common presentations.

    venv\\Scripts\\python manage.py seed_catalog

Idempotent: entries are matched on (name, strength, form), so re-running
updates the descriptive fields instead of creating duplicates. Pass --clear to
drop entries that are no longer in this list.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import CatalogMedicine, Form

# name, generic, strength, form, category, usage
CATALOG: list[tuple[str, str, str, str, str, str]] = [
    # --- pain and fever ---
    ("Paracetamol", "Acetaminophen", "500 mg", Form.TABLET, "Pain and fever", "For mild pain and fever."),
    ("Paracetamol", "Acetaminophen", "650 mg", Form.TABLET, "Pain and fever", "For mild pain and fever."),
    ("Paracetamol", "Acetaminophen", "120 mg/5 ml", Form.SYRUP, "Pain and fever", "Children's dose for pain and fever."),
    ("Paracetamol + Caffeine", "Acetaminophen, caffeine", "500/65 mg", Form.TABLET, "Pain and fever", "Pain relief with added caffeine."),
    ("Ibuprofen", "Ibuprofen", "200 mg", Form.TABLET, "Pain and inflammation", "For pain, swelling and fever."),
    ("Ibuprofen", "Ibuprofen", "400 mg", Form.TABLET, "Pain and inflammation", "For pain, swelling and fever."),
    ("Ibuprofen", "Ibuprofen", "100 mg/5 ml", Form.SYRUP, "Pain and inflammation", "Children's dose for pain and fever."),
    ("Aspirin", "Acetylsalicylic acid", "75 mg", Form.TABLET, "Blood thinner", "Low dose, to help prevent clots."),
    ("Aspirin", "Acetylsalicylic acid", "325 mg", Form.TABLET, "Pain and fever", "For pain, fever and inflammation."),
    ("Naproxen", "Naproxen", "250 mg", Form.TABLET, "Pain and inflammation", "For joint and muscle pain."),
    ("Diclofenac", "Diclofenac sodium", "50 mg", Form.TABLET, "Pain and inflammation", "For arthritis and joint pain."),
    ("Tramadol", "Tramadol", "50 mg", Form.CAPSULE, "Strong pain relief", "For moderate to severe pain."),

    # --- heart, blood pressure and cholesterol ---
    ("Amlodipine", "Amlodipine besylate", "5 mg", Form.TABLET, "Blood pressure", "Relaxes blood vessels to lower blood pressure."),
    ("Amlodipine", "Amlodipine besylate", "10 mg", Form.TABLET, "Blood pressure", "Relaxes blood vessels to lower blood pressure."),
    ("Lisinopril", "Lisinopril", "10 mg", Form.TABLET, "Blood pressure", "For high blood pressure and heart failure."),
    ("Losartan", "Losartan potassium", "50 mg", Form.TABLET, "Blood pressure", "For high blood pressure."),
    ("Telmisartan", "Telmisartan", "40 mg", Form.TABLET, "Blood pressure", "For high blood pressure."),
    ("Atenolol", "Atenolol", "50 mg", Form.TABLET, "Heart", "Slows the heart rate and lowers blood pressure."),
    ("Metoprolol", "Metoprolol succinate", "25 mg", Form.TABLET, "Heart", "For blood pressure and heart rhythm."),
    ("Bisoprolol", "Bisoprolol fumarate", "5 mg", Form.TABLET, "Heart", "For blood pressure and heart failure."),
    ("Atorvastatin", "Atorvastatin calcium", "10 mg", Form.TABLET, "Cholesterol", "Lowers cholesterol."),
    ("Atorvastatin", "Atorvastatin calcium", "20 mg", Form.TABLET, "Cholesterol", "Lowers cholesterol."),
    ("Rosuvastatin", "Rosuvastatin", "10 mg", Form.TABLET, "Cholesterol", "Lowers cholesterol."),
    ("Simvastatin", "Simvastatin", "20 mg", Form.TABLET, "Cholesterol", "Lowers cholesterol, usually taken at night."),
    ("Clopidogrel", "Clopidogrel", "75 mg", Form.TABLET, "Blood thinner", "Helps prevent blood clots."),
    ("Warfarin", "Warfarin sodium", "5 mg", Form.TABLET, "Blood thinner", "Prevents clots; needs regular blood tests."),
    ("Furosemide", "Furosemide", "40 mg", Form.TABLET, "Water tablet", "Removes excess fluid."),
    ("Digoxin", "Digoxin", "0.25 mg", Form.TABLET, "Heart", "Steadies and strengthens the heartbeat."),

    # --- diabetes ---
    ("Metformin", "Metformin hydrochloride", "500 mg", Form.TABLET, "Diabetes", "Lowers blood sugar. Take with food."),
    ("Metformin", "Metformin hydrochloride", "850 mg", Form.TABLET, "Diabetes", "Lowers blood sugar. Take with food."),
    ("Metformin XR", "Metformin hydrochloride", "1000 mg", Form.TABLET, "Diabetes", "Slow-release form, usually once a day."),
    ("Glimepiride", "Glimepiride", "2 mg", Form.TABLET, "Diabetes", "Helps the body release more insulin."),
    ("Gliclazide", "Gliclazide", "80 mg", Form.TABLET, "Diabetes", "Helps the body release more insulin."),
    ("Sitagliptin", "Sitagliptin", "100 mg", Form.TABLET, "Diabetes", "Lowers blood sugar after meals."),
    ("Insulin glargine", "Insulin glargine", "100 IU/ml", Form.INJECTION, "Diabetes", "Long-acting insulin, usually at night."),
    ("Insulin aspart", "Insulin aspart", "100 IU/ml", Form.INJECTION, "Diabetes", "Fast-acting insulin, taken with meals."),

    # --- stomach ---
    ("Omeprazole", "Omeprazole", "20 mg", Form.CAPSULE, "Stomach", "Reduces stomach acid. Take before food."),
    ("Pantoprazole", "Pantoprazole", "40 mg", Form.TABLET, "Stomach", "Reduces stomach acid."),
    ("Esomeprazole", "Esomeprazole", "40 mg", Form.CAPSULE, "Stomach", "Reduces stomach acid."),
    ("Ranitidine", "Ranitidine", "150 mg", Form.TABLET, "Stomach", "For heartburn and indigestion."),
    ("Domperidone", "Domperidone", "10 mg", Form.TABLET, "Stomach", "For nausea and bloating."),
    ("Ondansetron", "Ondansetron", "4 mg", Form.TABLET, "Nausea", "Stops nausea and vomiting."),
    ("Lactulose", "Lactulose", "10 g/15 ml", Form.SYRUP, "Constipation", "Softens stools."),

    # --- antibiotics and infection ---
    ("Amoxicillin", "Amoxicillin", "250 mg", Form.CAPSULE, "Antibiotic", "Finish the full course."),
    ("Amoxicillin", "Amoxicillin", "500 mg", Form.CAPSULE, "Antibiotic", "Finish the full course."),
    ("Amoxicillin + Clavulanate", "Co-amoxiclav", "625 mg", Form.TABLET, "Antibiotic", "Broad-spectrum antibiotic."),
    ("Azithromycin", "Azithromycin", "500 mg", Form.TABLET, "Antibiotic", "Usually a short three-day course."),
    ("Ciprofloxacin", "Ciprofloxacin", "500 mg", Form.TABLET, "Antibiotic", "For urinary and other infections."),
    ("Doxycycline", "Doxycycline", "100 mg", Form.CAPSULE, "Antibiotic", "Take with plenty of water, sitting upright."),
    ("Cefixime", "Cefixime", "200 mg", Form.TABLET, "Antibiotic", "For respiratory and urinary infections."),
    ("Metronidazole", "Metronidazole", "400 mg", Form.TABLET, "Antibiotic", "Avoid alcohol while taking this."),
    ("Fluconazole", "Fluconazole", "150 mg", Form.CAPSULE, "Antifungal", "For fungal infections."),
    ("Acyclovir", "Aciclovir", "400 mg", Form.TABLET, "Antiviral", "For cold sores and shingles."),

    # --- breathing and allergy ---
    ("Salbutamol", "Albuterol", "100 mcg", Form.INHALER, "Asthma", "Reliever inhaler for breathlessness."),
    ("Budesonide + Formoterol", "Budesonide, formoterol", "160/4.5 mcg", Form.INHALER, "Asthma", "Preventer inhaler, taken daily."),
    ("Montelukast", "Montelukast sodium", "10 mg", Form.TABLET, "Asthma", "Taken in the evening."),
    ("Cetirizine", "Cetirizine", "10 mg", Form.TABLET, "Allergy", "For hay fever, rashes and itching."),
    ("Loratadine", "Loratadine", "10 mg", Form.TABLET, "Allergy", "Non-drowsy allergy relief."),
    ("Fexofenadine", "Fexofenadine", "120 mg", Form.TABLET, "Allergy", "For hay fever and hives."),
    ("Prednisolone", "Prednisolone", "5 mg", Form.TABLET, "Steroid", "Take in the morning with food."),

    # --- thyroid, bones and vitamins ---
    ("Levothyroxine", "Levothyroxine sodium", "50 mcg", Form.TABLET, "Thyroid", "Take on an empty stomach in the morning."),
    ("Levothyroxine", "Levothyroxine sodium", "100 mcg", Form.TABLET, "Thyroid", "Take on an empty stomach in the morning."),
    ("Calcium + Vitamin D3", "Calcium carbonate, cholecalciferol", "500 mg/250 IU", Form.TABLET, "Supplement", "For bone strength."),
    ("Vitamin D3", "Cholecalciferol", "1000 IU", Form.TABLET, "Supplement", "Supports bones and immunity."),
    ("Vitamin B12", "Cyanocobalamin", "1500 mcg", Form.TABLET, "Supplement", "For nerve health and energy."),
    ("Ferrous sulphate", "Ferrous sulphate", "200 mg", Form.TABLET, "Supplement", "Iron for anaemia. Take with vitamin C."),
    ("Folic acid", "Folic acid", "5 mg", Form.TABLET, "Supplement", "Often taken with iron."),
    ("Alendronate", "Alendronic acid", "70 mg", Form.TABLET, "Bones", "Weekly tablet for osteoporosis."),

    # --- mind, sleep and nerves ---
    ("Amitriptyline", "Amitriptyline", "10 mg", Form.TABLET, "Nerve pain and sleep", "Taken at night."),
    ("Sertraline", "Sertraline", "50 mg", Form.TABLET, "Mood", "For depression and anxiety."),
    ("Escitalopram", "Escitalopram", "10 mg", Form.TABLET, "Mood", "For depression and anxiety."),
    ("Gabapentin", "Gabapentin", "300 mg", Form.CAPSULE, "Nerve pain", "For nerve pain."),
    ("Pregabalin", "Pregabalin", "75 mg", Form.CAPSULE, "Nerve pain", "For nerve pain and anxiety."),
    ("Melatonin", "Melatonin", "3 mg", Form.TABLET, "Sleep", "Taken about an hour before bed."),
    ("Donepezil", "Donepezil", "5 mg", Form.TABLET, "Memory", "For Alzheimer's disease, taken at night."),
    ("Levetiracetam", "Levetiracetam", "500 mg", Form.TABLET, "Seizures", "Taken twice a day."),

    # --- eyes, skin and other ---
    ("Latanoprost", "Latanoprost", "0.005%", Form.DROPS, "Eyes", "For glaucoma, one drop at night."),
    ("Timolol", "Timolol maleate", "0.5%", Form.DROPS, "Eyes", "For glaucoma."),
    ("Hydrocortisone", "Hydrocortisone", "1%", Form.CREAM, "Skin", "For itchy, inflamed skin."),
    ("Diclofenac gel", "Diclofenac", "1%", Form.CREAM, "Pain and inflammation", "Rub into the painful joint."),
    ("Nitroglycerin", "Glyceryl trinitrate", "0.4 mg", Form.PATCH, "Heart", "For chest pain (angina)."),
    ("Tamsulosin", "Tamsulosin", "0.4 mg", Form.CAPSULE, "Prostate", "Taken after the same meal each day."),
    ("Allopurinol", "Allopurinol", "100 mg", Form.TABLET, "Gout", "Prevents gout attacks."),
]


class Command(BaseCommand):
    help = "Seeds the medicine catalog with common medicines."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete catalog entries that are not in the seed list.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        created = updated = 0
        keep = []

        for name, generic, strength, form, category, usage in CATALOG:
            obj, was_created = CatalogMedicine.objects.update_or_create(
                name=name,
                strength=strength,
                form=form,
                defaults={
                    "generic_name": generic,
                    "category": category,
                    "usage": usage,
                    "is_active": True,
                },
            )
            keep.append(obj.pk)
            created += int(was_created)
            updated += int(not was_created)

        removed = 0
        if options["clear"]:
            removed, _ = CatalogMedicine.objects.exclude(pk__in=keep).delete()

        total = CatalogMedicine.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"catalog seeded: {created} created, {updated} updated, "
                f"{removed} removed, {total} total"
            )
        )
